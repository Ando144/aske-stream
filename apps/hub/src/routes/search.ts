import { Hono } from 'hono';
import { z } from 'zod';
import { isContinuationToken } from '@aske/shared/youtube';
import type { HubAppEnv } from '../env';
import { HubHttpError } from '../lib/http';
import { enforceRateLimit } from '../lib/rateLimit';
import { searchYoutube } from '../lib/search';

const SearchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  kind: z.enum(['songs', 'videos']).default('songs'),
  lang: z.enum(['es', 'en', 'eu']).default('es'),
  continuation: z.string().refine(isContinuationToken).optional(),
});

export const searchRoutes = new Hono<HubAppEnv>();

searchRoutes.get('/', async (c) => {
  const parsed = SearchQuery.safeParse(c.req.query());
  if (!parsed.success) throw new HubHttpError(400, 'invalid_request', 'Invalid search');
  await enforceRateLimit(c, c.env.DB, 'search', 60, 10 * 60 * 1000);
  const { q, kind, lang, continuation } = parsed.data;
  return c.json(await searchYoutube(q, kind, lang, continuation));
});
