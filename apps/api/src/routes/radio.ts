import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../env';
import { HttpError, RB_UUID_PATTERN } from '../lib/http';
import {
  countClick,
  listCountries,
  listTags,
  RadioBrowserUnavailable,
  searchStations,
} from '../lib/radioBrowser';

const CatalogQuery = z.object({
  q: z.string().trim().max(100).optional(),
  country: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/)
    .optional(),
  tag: z.string().trim().max(60).optional(),
  order: z.enum(['votes', 'clickcount', 'name', 'trend']).default('votes'),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(60).default(30),
});

/** Catalog proxy: keeps the User-Agent, mirror selection and caching server-side. */
export const radioRoutes = new Hono<AppEnv>()
  .get('/stations', async (c) => {
    const parsed = CatalogQuery.safeParse(c.req.query());
    if (!parsed.success) throw new HttpError(400, 'validation_error', 'Invalid catalog query');
    const { q, country, tag, ...rest } = parsed.data;
    const stations = await searchStations({
      ...rest,
      name: q || undefined,
      country: country?.toUpperCase() || undefined,
      tag: tag?.toLowerCase() || undefined,
    });
    c.header('Cache-Control', 'private, max-age=300');
    return c.json(stations);
  })

  .get('/tags', async (c) => {
    c.header('Cache-Control', 'private, max-age=86400');
    return c.json(await listTags(40));
  })

  .get('/countries', async (c) => {
    c.header('Cache-Control', 'private, max-age=86400');
    return c.json(await listCountries());
  })

  .post('/click/:uuid', async (c) => {
    const uuid = c.req.param('uuid');
    if (!RB_UUID_PATTERN.test(uuid)) {
      throw new HttpError(400, 'validation_error', 'Invalid station id');
    }
    c.executionCtx.waitUntil(countClick(uuid));
    return c.body(null, 202);
  });
