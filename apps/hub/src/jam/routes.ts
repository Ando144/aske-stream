import { Hono, type Context } from 'hono';
import { z } from 'zod';
import { HUB_LIMITS, normalizeJamCode, normalizeNickname, type CreatedJam } from '@aske/shared/hub';
import type { HubAppEnv } from '../env';
import { randomHex, sha256Hex } from '../lib/crypto';
import { HubHttpError } from '../lib/http';
import { randomCode } from '../lib/ids';
import { enforceRateLimit } from '../lib/rateLimit';
import { searchYoutube } from '../lib/search';

const MAX_CODE_ATTEMPTS = 5;
const HOUR_MS = 3600 * 1000;

const SearchQuery = z.object({
  q: z.string().trim().min(1).max(200),
  lang: z.enum(['es', 'en', 'eu']).default('es'),
});

function roomFor(c: Context<HubAppEnv>, rawCode: string) {
  const code = normalizeJamCode(rawCode);
  if (!code) throw new HubHttpError(404, 'not_found', 'That Jam does not exist');
  return { code, stub: c.env.JAM.get(c.env.JAM.idFromName(code)) };
}

async function requireJam(c: Context<HubAppEnv>) {
  const room = roomFor(c, c.req.param('code') ?? '');
  const info = await room.stub.info();
  if (!info) throw new HubHttpError(404, 'not_found', 'That Jam does not exist');
  return { ...room, info };
}

async function createJam(c: Context<HubAppEnv>): Promise<CreatedJam> {
  const body = z
    .object({ hostName: z.string().max(200) })
    .safeParse(await c.req.json().catch(() => null));
  const hostName = body.success ? normalizeNickname(body.data.hostName) : null;
  if (!hostName) throw new HubHttpError(400, 'invalid_request', 'Invalid host name');
  const hostKey = randomHex(16);
  const hostKeyHash = await sha256Hex(hostKey);
  const expiresAt = Date.now() + HUB_LIMITS.jamTtlMs;
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const code = randomCode(HUB_LIMITS.jamCodeLength);
    const { stub } = roomFor(c, code);
    if (await stub.init({ code, hostName, hostKeyHash, expiresAt })) {
      return { code, hostKey, expiresAt };
    }
  }
  throw new HubHttpError(500, 'internal_error', 'Could not create the Jam, try again');
}

export const jamRoutes = new Hono<HubAppEnv>()
  .post('/', async (c) => {
    await enforceRateLimit(c, c.env.DB, 'jam-create', 10, HOUR_MS);
    return c.json(await createJam(c), 201);
  })
  .get('/:code', async (c) => c.json((await requireJam(c)).info))
  .get('/:code/search', async (c) => {
    await requireJam(c);
    const parsed = SearchQuery.safeParse(c.req.query());
    if (!parsed.success) throw new HubHttpError(400, 'invalid_request', 'Invalid search');
    await enforceRateLimit(c, c.env.DB, 'jam-search', 60, 10 * 60 * 1000);
    return c.json({ results: await searchYoutube(parsed.data.q, 'songs', parsed.data.lang) });
  })
  .get('/:code/ws', async (c) => {
    if (c.req.header('Upgrade') !== 'websocket') {
      throw new HubHttpError(400, 'invalid_request', 'Expected a WebSocket connection');
    }
    const { stub } = await requireJam(c);
    return stub.fetch(c.req.raw);
  });
