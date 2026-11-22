import { Hono } from 'hono';
import { z } from 'zod';
import { HUB_LIMITS } from '@aske/shared/hub';
import { isPlaylistId } from '@aske/shared/youtube';
import type { HubAppEnv } from '../env';
import { HubHttpError } from '../lib/http';
import { fetchPlaylistPage } from '../lib/playlist';
import { enforceRateLimit } from '../lib/rateLimit';

const PlaylistQuery = z.object({
  lang: z.enum(['es', 'en', 'eu']).default('es'),
  continuation: z.string().min(1).max(HUB_LIMITS.continuationMax).optional(),
});

export const playlistRoutes = new Hono<HubAppEnv>();

playlistRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const parsed = PlaylistQuery.safeParse(c.req.query());
  if (!isPlaylistId(id) || !parsed.success) {
    throw new HubHttpError(400, 'invalid_request', 'Invalid playlist request');
  }
  await enforceRateLimit(c, c.env.DB, 'playlist', 120, 10 * 60 * 1000);
  const { lang, continuation } = parsed.data;
  const page = await fetchPlaylistPage(id, continuation ?? null, lang);
  if (!continuation && page.entries.length === 0 && !page.title && page.unavailable === 0) {
    throw new HubHttpError(404, 'playlist_unavailable', 'Playlist not found or private');
  }
  return c.json(page);
});
