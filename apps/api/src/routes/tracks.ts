import { Hono } from 'hono';
import { z } from 'zod';
import { LIMITS } from '@aske/shared';
import type { AppEnv } from '../env';
import { audioKey, bumpVersion, coverKey, toTrack, type TrackRow } from '../lib/db';
import { assertId, notFound, readJson } from '../lib/http';

const PatchTrack = z
  .object({
    title: z.string().trim().min(1).max(LIMITS.titleMax),
    artist: z.string().trim().max(LIMITS.titleMax),
    album: z.string().trim().max(LIMITS.titleMax),
    liked: z.boolean(),
    kind: z.enum(['music', 'podcast']),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const trackRoutes = new Hono<AppEnv>()
  .patch('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Track');
    const body = await readJson(c, PatchTrack);
    const db = c.env.DB;
    const now = Date.now();

    const sets: string[] = ['updated_at = ?'];
    const args: unknown[] = [now];
    for (const field of ['title', 'artist', 'album', 'kind'] as const) {
      if (body[field] !== undefined) {
        sets.push(`${field} = ?`);
        args.push(body[field]);
      }
    }
    if (body.liked !== undefined) {
      // Keep the original like time when liking twice, so "Liked songs" order is stable.
      sets.push(body.liked ? 'liked_at = COALESCE(liked_at, ?)' : 'liked_at = NULL');
      if (body.liked) args.push(now);
    }

    const [updated] = await db.batch([
      db.prepare(`UPDATE tracks SET ${sets.join(', ')} WHERE id = ? RETURNING *`).bind(...args, id),
      bumpVersion(db),
    ]);
    const row = updated!.results[0] as TrackRow | undefined;
    if (!row) throw notFound('Track');
    return c.json(toTrack(row));
  })

  .delete('/:id', async (c) => {
    const id = assertId(c.req.param('id'), 'Track');
    const db = c.env.DB;
    const [deleted] = await db.batch([
      db.prepare('DELETE FROM tracks WHERE id = ? RETURNING id').bind(id),
      bumpVersion(db),
    ]);
    if (!deleted!.results.length) throw notFound('Track');
    // Playlist memberships go away through ON DELETE CASCADE.
    await c.env.BUCKET.delete([audioKey(id), coverKey(id)]);
    return c.body(null, 204);
  });
