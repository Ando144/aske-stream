import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS } from '@aske/shared';
import type { AppEnv } from '../env';
import { toStation, type StationRow } from '../lib/db';
import { newId } from '../lib/ids';
import { assertId, notFound, RB_UUID_PATTERN, readJson } from '../lib/http';

/**
 * The PWA is served over HTTPS, and browsers block or auto-upgrade plain
 * HTTP media. Accepting only HTTPS streams avoids stations that can never play.
 */
const httpsUrl = z
  .string()
  .trim()
  .max(LIMITS.urlMax)
  .url()
  .refine((u) => u.startsWith('https://'), 'Only https:// streams can play in the app');

const optionalUrl = z.string().trim().max(LIMITS.urlMax).default('');

const SaveStation = z.object({
  rbUuid: z.string().regex(RB_UUID_PATTERN).nullable().default(null),
  name: z.string().trim().min(1).max(LIMITS.nameMax),
  streamUrl: httpsUrl,
  homepage: optionalUrl,
  favicon: optionalUrl,
  countryCode: z.string().trim().max(8).default(''),
  tags: z.array(z.string().trim().max(60)).max(20).default([]),
  codec: z.string().trim().max(30).default(''),
  bitrate: z.number().int().min(0).max(10_000).default(0),
  hls: z.boolean().default(false),
  liked: z.boolean().default(true),
});

const PatchStation = z
  .object({ liked: z.boolean(), name: z.string().trim().min(1).max(LIMITS.nameMax) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const stationRoutes = new Hono<AppEnv>()
  /** Liked stations first (most recent like on top), then the rest by name. */
  .get('/', async (c) => {
    const { results } = await c.env.DB.prepare(
      'SELECT * FROM stations ORDER BY liked_at IS NULL, liked_at DESC, name COLLATE NOCASE',
    ).all<StationRow>();
    return c.json(results.map(toStation));
  })

  /**
   * Saves a station. Catalog stations are upserted by their Radio Browser
   * uuid, so liking the same station twice never creates duplicates.
   */
  .post('/', async (c) => {
    const s = await readJson(c, SaveStation);
    const now = Date.now();
    const row = await c.env.DB.prepare(
      `INSERT INTO stations (id, rb_uuid, name, stream_url, homepage, favicon, country_code, tags,
                             codec, bitrate, hls, is_custom, liked_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (rb_uuid) DO UPDATE SET
         name = excluded.name, stream_url = excluded.stream_url, homepage = excluded.homepage,
         favicon = excluded.favicon, country_code = excluded.country_code, tags = excluded.tags,
         codec = excluded.codec, bitrate = excluded.bitrate, hls = excluded.hls,
         liked_at = CASE WHEN excluded.liked_at IS NULL THEN NULL
                         ELSE COALESCE(stations.liked_at, excluded.liked_at) END
       RETURNING *`,
    )
      .bind(
        newId(),
        s.rbUuid,
        s.name,
        s.streamUrl,
        s.homepage,
        s.favicon,
        s.countryCode.toUpperCase(),
        s.tags.map((t) => t.replace(/,/g, ' ')).join(','),
        s.codec,
        s.bitrate,
        s.hls ? 1 : 0,
        s.rbUuid ? 0 : 1,
        s.liked ? now : null,
        now,
      )
      .first<StationRow>();
    return c.json(toStation(row!), 201);
  })

  .patch('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Station');
    const body = await readJson(c, PatchStation);
    const sets: string[] = [];
    const args: unknown[] = [];
    if (body.name !== undefined) {
      sets.push('name = ?');
      args.push(body.name);
    }
    if (body.liked !== undefined) {
      sets.push(body.liked ? 'liked_at = COALESCE(liked_at, ?)' : 'liked_at = NULL');
      if (body.liked) args.push(Date.now());
    }
    const row = await c.env.DB.prepare(
      `UPDATE stations SET ${sets.join(', ')} WHERE id = ? RETURNING *`,
    )
      .bind(...args, id)
      .first<StationRow>();
    if (!row) throw notFound('Station');
    return c.json(toStation(row));
  })

  .delete('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Station');
    const res = await c.env.DB.prepare('DELETE FROM stations WHERE id = ?').bind(id).run();
    if (!res.meta.changes) throw notFound('Station');
    return c.body(null, 204);
  });
