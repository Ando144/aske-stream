import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS, reorderFolders, type Folder } from '@aske/shared';
import type { AppEnv } from '../env';
import { bumpVersion, toFolder, type FolderRow } from '../lib/db';
import { assertId, ID_PATTERN, notFound, readJson } from '../lib/http';
import { newId } from '../lib/ids';

const FolderBody = z.object({ name: z.string().trim().min(1).max(LIMITS.nameMax) });

export const FolderPatchBody = z
  .object({ name: FolderBody.shape.name, pinned: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const FolderOrderBody = z.object({ ids: z.array(z.string().regex(ID_PATTERN)).max(1000) });

async function saveFolderOrder(db: D1Database, ids: string[]): Promise<Folder[]> {
  const { results } = await db.prepare('SELECT * FROM folders').all<FolderRow>();
  const { folders, changed } = reorderFolders(results.map(toFolder), ids, Date.now());
  if (changed.length) {
    const update = db.prepare('UPDATE folders SET position = ?, updated_at = ? WHERE id = ?');
    await db.batch([
      ...changed.map((f) => update.bind(f.position, f.updatedAt, f.id)),
      bumpVersion(db),
    ]);
  }
  return folders;
}

export const folderRoutes = new Hono<AppEnv>()
  .post('/', async (c) => {
    const { name } = await readJson(c, FolderBody);
    const db = c.env.DB;
    const id = newId();
    const now = Date.now();
    const [, row] = await db.batch([
      db
        .prepare(
          `INSERT INTO folders (id, name, created_at, updated_at, position)
           VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM folders))`,
        )
        .bind(id, name, now, now),
      db.prepare('SELECT * FROM folders WHERE id = ?').bind(id),
      bumpVersion(db),
    ]);
    return c.json(toFolder(row!.results[0] as unknown as FolderRow), 201);
  })

  .put('/order', async (c) => {
    const { ids } = await readJson(c, FolderOrderBody);
    return c.json(await saveFolderOrder(c.env.DB, ids));
  })

  .patch('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Folder');
    const { name, pinned } = await readJson(c, FolderPatchBody);
    const db = c.env.DB;
    const now = Date.now();
    const [res, row] = await db.batch([
      db
        .prepare(
          `UPDATE folders SET name = COALESCE(?1, name),
             pinned_at = CASE WHEN ?2 IS NULL THEN pinned_at WHEN ?2 = 1 THEN ?3 ELSE NULL END,
             updated_at = ?3 WHERE id = ?4`,
        )
        .bind(name ?? null, pinned === undefined ? null : Number(pinned), now, id),
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
