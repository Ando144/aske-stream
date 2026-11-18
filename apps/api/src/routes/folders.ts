import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS } from '@aske/shared';
import type { AppEnv } from '../env';
import { bumpVersion, toFolder, type FolderRow } from '../lib/db';
import { assertId, notFound, readJson } from '../lib/http';
import { newId } from '../lib/ids';

const FolderBody = z.object({ name: z.string().trim().min(1).max(LIMITS.nameMax) });

export const folderRoutes = new Hono<AppEnv>()
  .post('/', async (c) => {
    const { name } = await readJson(c, FolderBody);
    const db = c.env.DB;
    const id = newId();
    const now = Date.now();
    await db.batch([
      db
        .prepare('INSERT INTO folders (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .bind(id, name, now, now),
      bumpVersion(db),
    ]);
    return c.json(toFolder({ id, name, created_at: now, updated_at: now }), 201);
  })

  .patch('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Folder');
    const { name } = await readJson(c, FolderBody);
    const db = c.env.DB;
    const [res, row] = await db.batch([
      db
        .prepare('UPDATE folders SET name = ?, updated_at = ? WHERE id = ?')
        .bind(name, Date.now(), id),
      db.prepare('SELECT * FROM folders WHERE id = ?').bind(id),
      bumpVersion(db),
    ]);
    if (!res!.meta.changes) throw notFound('Folder');
    return c.json(toFolder(row!.results[0] as unknown as FolderRow));
  })

  /** Its playlists go back to the top level; none is deleted. */
  .delete('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Folder');
    const db = c.env.DB;
    const [, res] = await db.batch([
      db.prepare('UPDATE playlists SET folder_id = NULL WHERE folder_id = ?').bind(id),
      db.prepare('DELETE FROM folders WHERE id = ?').bind(id),
      bumpVersion(db),
    ]);
    if (!res!.meta.changes) throw notFound('Folder');
    return c.body(null, 204);
  });
