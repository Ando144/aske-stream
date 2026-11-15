import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS } from '@aske/shared';
import type { AppEnv } from '../env';
import { audioKey, bumpVersion, coverKey, toTrack, type TrackRow } from '../lib/db';
import { newId } from '../lib/ids';
import { HttpError } from '../lib/http';

const Metadata = z.object({
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
});

const ExistsQuery = z.object({
  source: z.enum(['youtube', 'file']),
  ref: z.string().trim().min(1).max(200),
});

async function startsWith(file: File, signatures: number[][]): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return signatures.some((sig) => sig.every((byte, i) => head[i] === byte));
}

const OGG = [[0x4f, 0x67, 0x67, 0x53]]; // "OggS"
const WEBM = [[0x1a, 0x45, 0xdf, 0xa3]]; // EBML header (WebM/Matroska)
const IMAGE = [
  [0xff, 0xd8, 0xff], // JPEG
];

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
    if (cover && (cover.size > LIMITS.coverMaxBytes || !(await startsWith(cover, IMAGE)))) {
      throw new HttpError(415, 'unsupported_cover', 'Cover must be a JPEG under 2 MB');
    }

    const m = meta.data;
    const db = c.env.DB;
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

    const now = Date.now();
    try {
      const [inserted] = await db.batch([
        db
          .prepare(
            `INSERT INTO tracks (id, title, artist, album, duration_ms, size_bytes, bitrate_kbps,
                                 mime, audio_key, cover_key, source, source_ref, kind, liked_at,
                                 created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?) RETURNING *`,
          )
          .bind(
            id,
            m.title,
            m.artist,
            m.album,
            m.durationMs,
            audio.size,
            m.bitrateKbps,
            mime,
            audioKey(id),
            cover ? coverKey(id) : null,
            m.source,
            m.sourceRef,
            m.kind,
            now,
            now,
          ),
        bumpVersion(db),
      ]);
      return c.json(toTrack(inserted!.results[0] as TrackRow), 201);
    } catch (err) {
      // Never leave orphaned objects behind (e.g. a concurrent duplicate upload).
      await c.env.BUCKET.delete([audioKey(id), coverKey(id)]);
      if (String(err).includes('UNIQUE')) {
        throw new HttpError(409, 'duplicate', 'This source is already in the library');
      }
      throw err;
    }
  });
