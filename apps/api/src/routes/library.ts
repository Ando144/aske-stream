import { Hono } from 'hono';
import { sortFolders, sortPlaylists, type Library } from '@aske/shared';
import type { AppEnv } from '../env';
import {
  toFolder,
  toPlaylist,
  toTrack,
  type FolderRow,
  type PlaylistRow,
  type TrackRow,
} from '../lib/db';
import { storageStats } from '../lib/storage';

export const libraryRoutes = new Hono<AppEnv>()
  /** How full the storage is (Settings → Storage). */
  .get('/storage', async (c) => c.json(await storageStats(c.env)))
  .get('/', async (c) => {
    const db = c.env.DB;

    // A batch runs as one transaction, so the version always matches the data.
    const [versionRes, tracksRes, playlistsRes, membersRes, foldersRes] = await db.batch([
      db.prepare("SELECT value FROM meta WHERE key = 'library_version'"),
      db.prepare('SELECT * FROM tracks ORDER BY created_at DESC'),
      db.prepare('SELECT * FROM playlists ORDER BY created_at ASC'),
      db.prepare(
        'SELECT playlist_id, track_id FROM playlist_tracks ORDER BY playlist_id, position ASC',
      ),
      db.prepare('SELECT * FROM folders ORDER BY name COLLATE NOCASE ASC'),
    ]);

    const version = Number((versionRes!.results[0] as { value: string } | undefined)?.value ?? 0);
    const etag = `"v${version}"`;
    c.header('ETag', etag);
    c.header('Cache-Control', 'no-cache');
    if (c.req.header('if-none-match') === etag) return c.body(null, 304);

    const members = new Map<string, string[]>();
    for (const row of membersRes!.results as { playlist_id: string; track_id: string }[]) {
      const list = members.get(row.playlist_id);
      if (list) list.push(row.track_id);
      else members.set(row.playlist_id, [row.track_id]);
    }

    const library: Library = {
      version,
      tracks: (tracksRes!.results as unknown as TrackRow[]).map(toTrack),
      playlists: sortPlaylists(
        (playlistsRes!.results as unknown as PlaylistRow[]).map((p) =>
          toPlaylist(p, members.get(p.id) ?? []),
        ),
      ),
      folders: sortFolders((foldersRes!.results as unknown as FolderRow[]).map(toFolder)),
    };
    return c.json(library);
  });
