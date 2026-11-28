/// <reference path="../../hub/test/node-sqlite.d.ts" />
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../src/env';
import { HttpError } from '../src/lib/http';
import { cancelUpload, Metadata, parseUploadId, UploadId } from '../src/lib/uploads';
import { ingestRoutes } from '../src/routes/ingest';

const meta = { title: 'Song', durationMs: 1000, source: 'youtube' };

const INVALID_IDS = ['', 'with space', 'a/b', '../etc', ' padded ', 'ñ', 'x'.repeat(101)];
const VALID_IDS = ['a', 'job-1_B', 'x'.repeat(100)];

describe('upload id', () => {
  it('accepts letters, digits, dashes and underscores up to 100 characters', () => {
    for (const id of VALID_IDS) expect(parseUploadId(id)).toBe(id);
  });

  it('rejects anything else with a 400 validation_error', () => {
    for (const id of INVALID_IDS) {
      expect(UploadId.safeParse(id).success, JSON.stringify(id)).toBe(false);
      expect(() => parseUploadId(id)).toThrow(HttpError);
    }
    expect(() => parseUploadId(undefined)).toThrow(
      expect.objectContaining({ status: 400, code: 'validation_error' }),
    );
  });
});

describe('upload metadata', () => {
  it('keeps a valid uploadId', () => {
    expect(Metadata.parse({ ...meta, uploadId: 'job-1' }).uploadId).toBe('job-1');
  });

  it('defaults to null without uploadId (CLI and library copy)', () => {
    expect(Metadata.parse(meta).uploadId).toBeNull();
  });

  it('rejects an invalid uploadId', () => {
    for (const uploadId of [...INVALID_IDS, 7, null]) {
      const parsed = Metadata.safeParse({ ...meta, uploadId });
      expect(parsed.success, JSON.stringify(uploadId)).toBe(false);
    }
  });
});

type Param = null | number | string;

/** The part of D1Database that cancelUpload uses, backed by a real SQLite in memory. */
function createDb() {
  const sqlite = new DatabaseSync(':memory:');
  const dir = join(import.meta.dirname, '..', 'migrations');
  for (const file of readdirSync(dir).sort()) {
    sqlite.exec(readFileSync(join(dir, file), 'utf8'));
  }
  const prepare = (sql: string) => {
    let params: Param[] = [];
    const statement = {
      bind: (...args: Param[]) => {
        params = args;
        return statement;
      },
      exec: () => ({ results: sqlite.prepare(sql).all(...params) }),
    };
    return statement;
  };
  const batch = async (statements: ReturnType<typeof prepare>[]) => {
    sqlite.exec('BEGIN');
    const results = statements.map((s) => s.exec());
    sqlite.exec('COMMIT');
    return results;
  };
  return { sqlite, d1: { prepare, batch } as unknown as D1Database };
}

describe('canceling an upload', () => {
  const SINCE = 5000;
  const legacy = { ref: 'video-1', since: SINCE };
  const bucketDelete = vi.fn(async (_keys: string[]) => undefined);
  const bucket = { delete: bucketDelete } as unknown as R2Bucket;
  let db: ReturnType<typeof createDb>;

  function addTrack(id: string, ref: string, createdAt: number, uploadId: string | null = null) {
    db.sqlite
      .prepare(
        `INSERT INTO tracks (id, title, duration_ms, size_bytes, audio_key, source, source_ref,
                             created_at, updated_at, upload_id)
         VALUES (?, 'Song', 1, 1, 'key', 'youtube', ?, ?, ?, ?)`,
      )
      .run(id, ref, createdAt, createdAt, uploadId);
  }

  const trackIds = () =>
    (db.sqlite.prepare('SELECT id FROM tracks ORDER BY id').all() as { id: string }[]).map(
      (row) => row.id,
    );

  beforeEach(() => {
    db = createDb();
    bucketDelete.mockClear();
  });

  it('removes only the track of that upload without a legacy hint', async () => {
    addTrack('own', 'video-2', SINCE, 'job-1');
    addTrack('old-worker', 'video-1', SINCE);
    expect(await cancelUpload(db.d1, bucket, 'job-1')).toEqual(['own']);
    expect(trackIds()).toEqual(['old-worker']);
    expect(bucketDelete).toHaveBeenCalledExactlyOnceWith([
      'tracks/own/audio.opus',
      'tracks/own/cover.jpg',
    ]);
  });

  it('also removes the track an old Worker saved for that video since then', async () => {
    addTrack('legacy', 'video-1', SINCE);
    expect(await cancelUpload(db.d1, bucket, 'job-1', legacy)).toEqual(['legacy']);
    expect(trackIds()).toEqual([]);
    expect(bucketDelete).toHaveBeenCalledExactlyOnceWith([
      'tracks/legacy/audio.opus',
      'tracks/legacy/cover.jpg',
    ]);
  });

  it.each([
    ['saved before the download started', 'video-1', SINCE - 1, null],
    ['of another video', 'video-2', SINCE, null],
    ['of another upload', 'video-1', SINCE, 'job-2'],
  ])('keeps a track %s', async (_case, ref, createdAt, uploadId) => {
    addTrack('kept', ref, createdAt, uploadId);
    expect(await cancelUpload(db.d1, bucket, 'job-1', legacy)).toEqual([]);
    expect(trackIds()).toEqual(['kept']);
    expect(bucketDelete).not.toHaveBeenCalled();
  });

  it('reports the tracks removed by both rules', async () => {
    addTrack('own', 'video-2', SINCE, 'job-1');
    addTrack('legacy', 'video-1', SINCE + 1);
    const ids = await cancelUpload(db.d1, bucket, 'job-1', legacy);
    expect(ids.sort()).toEqual(['legacy', 'own']);
    expect(trackIds()).toEqual([]);
  });

  describe('DELETE /uploads/:uploadId', () => {
    const app = new Hono<AppEnv>()
      .route('/', ingestRoutes)
      .onError((err, c) =>
        err instanceof HttpError ? c.json({ error: err.code }, err.status) : c.json({}, 500),
      );
    const remove = (query: string) =>
      app.request(`/uploads/job-1${query}`, { method: 'DELETE' }, { DB: db.d1, BUCKET: bucket });

    it('passes the legacy hint on', async () => {
      addTrack('legacy', 'video-1', SINCE);
      const res = await remove(`?ref=video-1&since=${SINCE}`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ deletedIds: ['legacy'] });
    });

    it('works without a hint', async () => {
      addTrack('old-worker', 'video-1', SINCE);
      const res = await remove('');
      expect(await res.json()).toEqual({ deletedIds: [] });
      expect(trackIds()).toEqual(['old-worker']);
    });

    it.each([
      '?ref=video-1',
      '?since=0',
      '?ref=&since=0',
      '?ref=video-1&since=',
      '?ref=a%20b&since=0',
      `?ref=${'x'.repeat(65)}&since=0`,
      '?ref=video-1&since=-1',
      '?ref=video-1&since=1.5',
      '?ref=video-1&since=1e3',
      '?ref=video-1&since=99999999999999999999',
    ])('rejects %s with a 400 validation_error', async (query) => {
      addTrack('kept', 'video-1', SINCE);
      const res = await remove(query);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: 'validation_error' });
      expect(trackIds()).toEqual(['kept']);
    });
  });
});
