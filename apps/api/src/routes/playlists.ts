import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS } from '@aske/shared';
import type { AppEnv } from '../env';
import { bumpVersion, toPlaylist, type PlaylistRow } from '../lib/db';
import { newId } from '../lib/ids';
import { assertId, HttpError, ID_PATTERN, notFound, readJson } from '../lib/http';

const TrackIds = z
  .array(z.string().regex(ID_PATTERN))
  .max(LIMITS.playlistBatchMax)
  .transform((ids) => [...new Set(ids)]);

const CreatePlaylist = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameMax),
  description: z.string().trim().max(LIMITS.descriptionMax).default(''),
  trackIds: TrackIds.default([]),
});

const PatchPlaylist = z
  .object({
    name: z.string().trim().min(1).max(LIMITS.nameMax),
    description: z.string().trim().max(LIMITS.descriptionMax),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

const TrackIdsBody = z.object({ trackIds: TrackIds });

async function loadPlaylist(db: D1Database, id: string) {
  const [pl, members] = await db.batch([
    db.prepare('SELECT * FROM playlists WHERE id = ?').bind(id),
    db
      .prepare('SELECT track_id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position')
      .bind(id),
  ]);
  const row = pl!.results[0] as PlaylistRow | undefined;
  if (!row) throw notFound('Playlist');
  return toPlaylist(
    row,
    (members!.results as { track_id: string }[]).map((m) => m.track_id),
  );
}

/*
 * The Workers free plan allows 50 D1 queries per request, so membership
 * changes are set-based: the ids travel as one JSON parameter and SQLite's
 * json_each() expands them. One statement, whatever the playlist size.
 * Ids that do not exist in `tracks` are silently skipped.
 */
const appendMembers = (db: D1Database, playlistId: string, trackIds: string[]) =>
  db
    .prepare(
      `INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at)
       SELECT ?1, j.value,
              COALESCE((SELECT MAX(position) FROM playlist_tracks WHERE playlist_id = ?1), -1) + 1 + j.key,
              ?2
       FROM json_each(?3) AS j
       WHERE j.value IN (SELECT id FROM tracks)`,
    )
    .bind(playlistId, Date.now(), JSON.stringify(trackIds));

const touch = (db: D1Database, id: string) =>
  db.prepare('UPDATE playlists SET updated_at = ? WHERE id = ?').bind(Date.now(), id);

export const playlistRoutes = new Hono<AppEnv>()
  .post('/', async (c) => {
    const body = await readJson(c, CreatePlaylist);
    const db = c.env.DB;
    const id = newId();
    const now = Date.now();
    await db.batch([
      db
        .prepare(
          'INSERT INTO playlists (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        )
        .bind(id, body.name, body.description, now, now),
      appendMembers(db, id, body.trackIds),
      bumpVersion(db),
    ]);
    return c.json(await loadPlaylist(db, id), 201);
  })

  .patch('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Playlist');
    const body = await readJson(c, PatchPlaylist);
    const db = c.env.DB;
    const sets = ['updated_at = ?'];
    const args: unknown[] = [Date.now()];
    if (body.name !== undefined) {
      sets.push('name = ?');
      args.push(body.name);
    }
    if (body.description !== undefined) {
      sets.push('description = ?');
      args.push(body.description);
    }
    const [res] = await db.batch([
      db.prepare(`UPDATE playlists SET ${sets.join(', ')} WHERE id = ?`).bind(...args, id),
      bumpVersion(db),
    ]);
    if (!res!.meta.changes) throw notFound('Playlist');
    return c.json(await loadPlaylist(db, id));
  })

  .delete('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Playlist');
    const db = c.env.DB;
    const [res] = await db.batch([
      db.prepare('DELETE FROM playlists WHERE id = ?').bind(id),
      bumpVersion(db),
    ]);
    if (!res!.meta.changes) throw notFound('Playlist');
    return c.body(null, 204);
  })

  /** Appends tracks; tracks already in the playlist keep their position. */
  .post('/:id/tracks', async (c) => {
    const id = assertId(c.req.param('id'), 'Playlist');
    const { trackIds } = await readJson(c, TrackIdsBody);
    const db = c.env.DB;
    await loadPlaylist(db, id); // 404 if it does not exist
    const [res] = await db.batch([appendMembers(db, id, trackIds), touch(db, id)]);
    if (res!.meta.changes) await bumpVersion(db).run();
    return c.json(await loadPlaylist(db, id));
  })

  /** Replaces the order (drag & drop). Must be a permutation of the current tracks. */
  .put('/:id/tracks', async (c) => {
    const id = assertId(c.req.param('id'), 'Playlist');
    const { trackIds } = await readJson(c, TrackIdsBody);
    const db = c.env.DB;
    const current = await loadPlaylist(db, id);
    const currentSet = new Set(current.trackIds);
    if (trackIds.length !== currentSet.size || !trackIds.every((t) => currentSet.has(t))) {
      throw new HttpError(400, 'not_a_permutation', 'trackIds must contain the same tracks');
    }
    await db.batch([
      db
        .prepare(
          `UPDATE playlist_tracks
           SET position = (SELECT j.key FROM json_each(?1) AS j WHERE j.value = playlist_tracks.track_id)
           WHERE playlist_id = ?2`,
        )
        .bind(JSON.stringify(trackIds), id),
      touch(db, id),
      bumpVersion(db),
    ]);
    return c.json(await loadPlaylist(db, id));
  })

  .delete('/:id/tracks/:trackId', async (c) => {
    const id = assertId(c.req.param('id'), 'Playlist');
    const trackId = assertId(c.req.param('trackId'), 'Track');
    const db = c.env.DB;
    const [res] = await db.batch([
      db
        .prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?')
        .bind(id, trackId),
      touch(db, id),
      bumpVersion(db),
    ]);
    if (!res!.meta.changes) throw notFound('Track in playlist');
    return c.json(await loadPlaylist(db, id));
  });
