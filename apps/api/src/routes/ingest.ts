import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS } from '@aske/shared';
import type { AppEnv } from '../env';
import { audioKey, bumpVersion, coverKey, toTrack, type TrackRow } from '../lib/db';
import { newId } from '../lib/ids';
import { HttpError } from '../lib/http';
import { isJpeg, startsWith } from '../lib/image';
import { storageStats } from '../lib/storage';
import {
  cancelUpload,
  insertTrack,
  Metadata,
  parseLegacyHint,
  parseUploadId,
} from '../lib/uploads';

const ExistsQuery = z.object({
  source: z.enum(['youtube', 'file']),
  ref: z.string().trim().min(1).max(200),
});

const OGG = [[0x4f, 0x67, 0x67, 0x53]]; // "OggS"
const WEBM = [[0x1a, 0x45, 0xdf, 0xa3]]; // EBML header (WebM/Matroska)

/** Upload endpoint used by the ingest CLI (authenticated with the access key). */
export const ingestRoutes = new Hono<AppEnv>()
  .get('/exists', async (c) => {
    const parsed = ExistsQuery.safeParse(c.req.query());
    if (!parsed.success) throw new HttpError(400, 'validation_error', 'Invalid query');
    const row = await c.env.DB.prepare('SELECT id FROM tracks WHERE source = ? AND source_ref = ?')
      .bind(parsed.data.source, parsed.data.ref)
      .first<{ id: string }>();
    return c.json({ exists: !!row, id: row?.id ?? null });
  })

  /**
   * multipart/form-data with three parts:
   *   meta  – JSON matching {@link Metadata}
   *   audio – Ogg Opus file
   *   cover – optional square JPEG
   */
  .post('/tracks', async (c) => {
    let form: FormData;
    try {
      form = await c.req.formData();
    } catch {
      throw new HttpError(400, 'invalid_form', 'Expected multipart/form-data');
    }

    const metaRaw = form.get('meta');
    let metaJson: unknown;
    try {
      metaJson = typeof metaRaw === 'string' ? JSON.parse(metaRaw) : null;
    } catch {
      metaJson = null;
    }
    const meta = Metadata.safeParse(metaJson);
    if (!meta.success) {
      const issue = meta.error.issues[0];
      throw new HttpError(
        400,
        'validation_error',
        `meta.${issue?.path.join('.') ?? ''}: ${issue?.message ?? 'invalid'}`,
      );
    }

    const audio = form.get('audio');
    if (!(audio instanceof File) || audio.size === 0) {
      throw new HttpError(400, 'missing_audio', 'The audio part is required');
    }
    if (audio.size > LIMITS.audioMaxBytes) {
      throw new HttpError(413, 'too_large', 'Audio file is too large');
    }
    // Ogg Opus (CLI) or WebM Opus (downloaded on the phone, stored as-is).
    const isOgg = await startsWith(audio, OGG);
    if (!isOgg && !(await startsWith(audio, WEBM))) {
      throw new HttpError(415, 'unsupported_audio', 'Audio must be Opus in Ogg or WebM');
    }
    const mime = isOgg ? 'audio/ogg' : 'audio/webm';

    const coverPart = form.get('cover');
    const cover = coverPart instanceof File && coverPart.size > 0 ? coverPart : null;
    if (cover && (cover.size > LIMITS.coverMaxBytes || !(await isJpeg(cover)))) {
      throw new HttpError(415, 'unsupported_cover', 'Cover must be a JPEG under 2 MB');
    }

    const m = meta.data;
    const db = c.env.DB;

    // Never go over the free storage budget.
    const stats = await storageStats(c.env);
    if (stats.usedBytes + audio.size + (cover?.size ?? 0) > stats.uploadLimitBytes) {
      throw new HttpError(
        507,
        'storage_full',
        `Storage is full: ${(stats.usedBytes / 1e9).toFixed(2)} GB of ${(stats.limitBytes / 1e9).toFixed(0)} GB used`,
      );
    }
    if (m.sourceRef) {
      const dup = await db
        .prepare('SELECT id FROM tracks WHERE source = ? AND source_ref = ?')
        .bind(m.source, m.sourceRef)
        .first<{ id: string }>();
      if (dup) throw new HttpError(409, 'duplicate', `Already in the library as ${dup.id}`);
    }

    const id = newId();
    // Upload the objects first; the row only appears once the files exist.
    await c.env.BUCKET.put(audioKey(id), audio.stream(), {
      httpMetadata: { contentType: `${mime}; codecs=opus` },
      customMetadata: { title: m.title.slice(0, 200) },
    });
    if (cover) {
      await c.env.BUCKET.put(coverKey(id), cover.stream(), {
        httpMetadata: { contentType: 'image/jpeg' },
      });
    }

    try {
      const [inserted] = await db.batch([
        insertTrack(db, {
          ...m,
          id,
          sizeBytes: audio.size,
          mime,
          hasCover: cover !== null,
        }),
        bumpVersion(db),
      ]);
      const row = inserted!.results[0] as TrackRow | undefined;
      if (!row) throw new HttpError(410, 'upload_canceled', 'This upload was canceled');
      return c.json(toTrack(row), 201);
    } catch (err) {
      // Never leave orphaned objects behind (e.g. a canceled or concurrent duplicate upload).
      await c.env.BUCKET.delete([audioKey(id), coverKey(id)]);
      if (String(err).includes('UNIQUE')) {
        throw new HttpError(409, 'duplicate', 'This source is already in the library');
      }
      throw err;
    }
  })

  .delete('/uploads/:uploadId', async (c) => {
    const uploadId = parseUploadId(c.req.param('uploadId'));
    const legacy = parseLegacyHint(c.req.query());
    const deletedIds = await cancelUpload(c.env.DB, c.env.BUCKET, uploadId, legacy);
    return c.json({ deletedIds });
  });
