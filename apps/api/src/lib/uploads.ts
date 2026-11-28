import { z } from 'zod';
import { LIMITS } from '@aske/shared';
import { audioKey, bumpVersion, coverKey } from './db';
import { HttpError } from './http';

/** How long a canceled upload keeps being rejected if it arrives late. */
const CANCEL_TTL_MS = 30 * 24 * 3600 * 1000;

/** Chosen by the client, one per download; links an upload to its cancellation. */
export const UploadId = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);

export function parseUploadId(raw: string | undefined): string {
  const parsed = UploadId.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, 'validation_error', 'Invalid upload id');
  return parsed.data;
}

export const Metadata = z.object({
  title: z.string().trim().min(1).max(LIMITS.titleMax),
  artist: z.string().trim().max(LIMITS.titleMax).default(''),
  album: z.string().trim().max(LIMITS.titleMax).default(''),
  durationMs: z
    .number()
    .int()
    .positive()
    .max(24 * 3600 * 1000),
  bitrateKbps: z.number().int().positive().max(2000).nullable().default(null),
  source: z.enum(['youtube', 'file']),
  sourceRef: z.string().trim().min(1).max(200).nullable().default(null),
  kind: z.enum(['music', 'podcast']).default('music'),
  uploadId: UploadId.optional().transform((id) => id ?? null),
});

export interface NewTrack extends z.infer<typeof Metadata> {
  id: string;
  sizeBytes: number;
  mime: string;
  hasCover: boolean;
}

/**
 * Inserts nothing when the upload was canceled. The check lives inside the statement so a
 * cancellation cannot slip in between reading and writing.
 */
export function insertTrack(db: D1Database, t: NewTrack): D1PreparedStatement {
  const now = Date.now();
  return db
    .prepare(
      `INSERT INTO tracks (id, title, artist, album, duration_ms, size_bytes, bitrate_kbps,
                           mime, audio_key, cover_key, source, source_ref, kind, liked_at,
                           created_at, updated_at, upload_id)
       SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?
       WHERE NOT EXISTS (SELECT 1 FROM canceled_uploads WHERE upload_id = ?)
       RETURNING *`,
    )
    .bind(
      t.id,
      t.title,
      t.artist,
      t.album,
      t.durationMs,
      t.sizeBytes,
      t.bitrateKbps,
      t.mime,
      audioKey(t.id),
      t.hasCover ? coverKey(t.id) : null,
      t.source,
      t.sourceRef,
      t.kind,
      now,
      now,
      t.uploadId,
      t.uploadId,
    );
}

/** Points at a track saved by an older Worker, which did not store the upload id. */
export interface LegacyHint {
  ref: string;
  since: number;
}

const LegacyQuery = z.object({
  ref: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/),
  since: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int()),
});

/** `ref` and `since` are optional, but only together. */
export function parseLegacyHint(query: Record<string, string>): LegacyHint | undefined {
  if (query.ref === undefined && query.since === undefined) return undefined;
  const parsed = LegacyQuery.safeParse(query);
  if (!parsed.success) throw new HttpError(400, 'validation_error', 'Invalid ref or since');
  return parsed.data;
}

function deleteUploadedTracks(
  db: D1Database,
  uploadId: string,
  legacy?: LegacyHint,
): D1PreparedStatement[] {
  const own = db.prepare('DELETE FROM tracks WHERE upload_id = ? RETURNING id').bind(uploadId);
  if (!legacy) return [own];
  const old = db
    .prepare(
      `DELETE FROM tracks
       WHERE upload_id IS NULL AND source = 'youtube' AND source_ref = ? AND created_at >= ?
       RETURNING id`,
    )
    .bind(legacy.ref, legacy.since);
  return [own, old];
}

/**
 * Remembers the cancellation and removes what that upload already created, in one
 * transaction: the track is either inserted before (and deleted here) or never inserted.
 */
export async function cancelUpload(
  db: D1Database,
  bucket: R2Bucket,
  uploadId: string,
  legacy?: LegacyHint,
): Promise<string[]> {
  const now = Date.now();
  const deletions = deleteUploadedTracks(db, uploadId, legacy);
  const results = await db.batch<{ id: string }>([
    db
      .prepare('INSERT OR IGNORE INTO canceled_uploads (upload_id, canceled_at) VALUES (?, ?)')
      .bind(uploadId, now),
    ...deletions,
    db.prepare('DELETE FROM canceled_uploads WHERE canceled_at < ?').bind(now - CANCEL_TTL_MS),
    bumpVersion(db),
  ]);
  const deleted = results.slice(1, 1 + deletions.length).flatMap((result) => result.results);
  const ids = [...new Set(deleted.map((row) => row.id))];
  if (ids.length) await bucket.delete(ids.flatMap((id) => [audioKey(id), coverKey(id)]));
  return ids;
}
