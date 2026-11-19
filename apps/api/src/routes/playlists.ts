import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { LIMITS, reorderPlaylists, type Playlist } from '@aske/shared';
import type { AppEnv, Env } from '../env';
import { bumpVersion, playlistCoverKey, toPlaylist, type PlaylistRow } from '../lib/db';
import { isJpeg } from '../lib/image';
import { storageStats } from '../lib/storage';
import { newId } from '../lib/ids';
import { assertId, HttpError, ID_PATTERN, notFound, readJson } from '../lib/http';

const TrackIds = z
  .array(z.string().regex(ID_PATTERN))
  .max(LIMITS.playlistMaxTracks)
  .transform((ids) => [...new Set(ids)]);

const CreatePlaylist = z.object({
  name: z.string().trim().min(1).max(LIMITS.nameMax),
  description: z.string().trim().max(LIMITS.descriptionMax).default(''),
  trackIds: TrackIds.default([]),
});

export const PatchPlaylist = z
  .object({
    name: z.string().trim().min(1).max(LIMITS.nameMax),
    description: z.string().trim().max(LIMITS.descriptionMax),
    folderId: z.string().regex(ID_PATTERN).nullable(),
    pinned: z.boolean(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const PlaylistOrderBody = z.object({
  folderId: z.string().regex(ID_PATTERN).nullable(),
  ids: z.array(z.string().regex(ID_PATTERN)).max(1000),
});

/** Next free position at the end of a container (null = top level). */
const END_OF_CONTAINER = `(SELECT COALESCE(MAX(position), -1) + 1 FROM playlists WHERE folder_id IS ?)`;

async function savePlaylistOrder(
  db: D1Database,
  folderId: string | null,
  ids: string[],
): Promise<Playlist[]> {
  const [rows, members] = await db.batch([
    db.prepare('SELECT * FROM playlists'),
    db.prepare('SELECT playlist_id, track_id FROM playlist_tracks ORDER BY position ASC'),
  ]);
  const tracksOf = new Map<string, string[]>();
  for (const m of members!.results as { playlist_id: string; track_id: string }[]) {
    const list = tracksOf.get(m.playlist_id);
    if (list) list.push(m.track_id);
    else tracksOf.set(m.playlist_id, [m.track_id]);
  }
  const all = (rows!.results as unknown as PlaylistRow[]).map((r) =>
    toPlaylist(r, tracksOf.get(r.id) ?? []),
  );
  const { playlists, changed } = reorderPlaylists(all, folderId, ids, Date.now());
  if (changed.length) {
    const update = db.prepare('UPDATE playlists SET position = ?, updated_at = ? WHERE id = ?');
    await db.batch([
      ...changed.map((p) => update.bind(p.position, p.updatedAt, p.id)),
      bumpVersion(db),
    ]);
  }
  return playlists;
}

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

async function assertFolderExists(db: D1Database, folderId: string | null) {
  if (folderId === null) return;
  const row = await db.prepare('SELECT id FROM folders WHERE id = ?').bind(folderId).first();
  if (!row) throw new HttpError(400, 'folder_not_found', 'Folder not found');
}

/** Reads the `cover` part, which must be a non-empty JPEG within the size limit. */
async function readCoverUpload(c: Context): Promise<File> {
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new HttpError(400, 'invalid_form', 'Expected multipart/form-data');
  }
  const part = form.get('cover');
  if (!(part instanceof File) || part.size === 0) {
    throw new HttpError(400, 'missing_cover', 'The cover part is required');
  }
  if (part.size > LIMITS.coverMaxBytes || !(await isJpeg(part))) {
    throw new HttpError(415, 'unsupported_cover', 'Cover must be a JPEG under 2 MB');
  }
  return part;
}

async function assertRoomForCover(env: Env, id: string, size: number) {
  const stats = await storageStats(env);
  const hadCover = await env.DB.prepare('SELECT cover_at FROM playlists WHERE id = ?')
    .bind(id)
    .first<{ cover_at: number | null }>();
  // Replacing a cover does not add a new estimate on top of the one already counted.
  const extra = hadCover?.cover_at ? 0 : size;
  if (stats.usedBytes + extra > stats.uploadLimitBytes) {
    throw new HttpError(507, 'storage_full', 'Storage is full');
  }
}

const setCoverAt = (db: D1Database, id: string, at: number | null) =>
  db
    .prepare('UPDATE playlists SET cover_at = ?, updated_at = ? WHERE id = ?')
    .bind(at, Date.now(), id);

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
          `INSERT INTO playlists (id, name, description, created_at, updated_at, position)
           VALUES (?, ?, ?, ?, ?, ${END_OF_CONTAINER})`,
        )
        .bind(id, body.name, body.description, now, now, null),
      appendMembers(db, id, body.trackIds),
      bumpVersion(db),
    ]);
    return c.json(await loadPlaylist(db, id), 201);
  })

  .put('/order', async (c) => {
    const { folderId, ids } = await readJson(c, PlaylistOrderBody);
    return c.json({ playlists: await savePlaylistOrder(c.env.DB, folderId, ids) });
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
    if (body.folderId !== undefined) {
      await assertFolderExists(db, body.folderId);
      sets.push('folder_id = ?', `position = ${END_OF_CONTAINER}`);
      args.push(body.folderId, body.folderId);
    }
    if (body.pinned !== undefined) {
      sets.push('pinned_at = ?');
      args.push(body.pinned ? Date.now() : null);
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
    await c.env.BUCKET.delete(playlistCoverKey(id));
    return c.body(null, 204);
  })

  /** multipart/form-data with one part, `cover`: a square JPEG already resized by the client. */
  .put('/:id/cover', async (c) => {
    const id = assertId(c.req.param('id'), 'Playlist');
    const db = c.env.DB;
    await loadPlaylist(db, id); // 404 if it does not exist
    const cover = await readCoverUpload(c);
    await assertRoomForCover(c.env, id, cover.size);
    await c.env.BUCKET.put(playlistCoverKey(id), cover.stream(), {
      httpMetadata: { contentType: 'image/jpeg' },
    });
    await db.batch([setCoverAt(db, id, Date.now()), bumpVersion(db)]);
    return c.json(await loadPlaylist(db, id));
  })

  .delete('/:id/cover', async (c) => {
    const id = assertId(c.req.param('id'), 'Playlist');
    const db = c.env.DB;
    await loadPlaylist(db, id);
    await c.env.BUCKET.delete(playlistCoverKey(id));
    await db.batch([setCoverAt(db, id, null), bumpVersion(db)]);
    return c.json(await loadPlaylist(db, id));
  })

  /** Appends tracks; tracks already in the playlist keep their position. */
  .post('/:id/tracks', async (c) => {
    const id = assertId(c.req.param('id'), 'Playlist');
    const { trackIds } = await readJson(c, TrackIdsBody);
    const db = c.env.DB;
    const current = await loadPlaylist(db, id); // 404 if it does not exist
    const total = new Set([...current.trackIds, ...trackIds]).size;
    if (total > LIMITS.playlistMaxTracks) {
      throw new HttpError(
        400,
        'playlist_full',
        `A playlist can hold up to ${LIMITS.playlistMaxTracks} songs`,
      );
    }
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
