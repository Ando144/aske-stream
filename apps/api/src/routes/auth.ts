import { Hono, type Context } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { SESSION_COOKIE } from '@aske/shared';
import { normalizePairingCode } from '@aske/shared/pairing';
import type { AppEnv } from '../env';
import { getAccessKey, isAuthenticated, requireAuth } from '../lib/auth';
import { createSessionToken, safeEqual, SESSION_MAX_AGE_S } from '../lib/crypto';
import { HttpError, readJson } from '../lib/http';
import { claimPairingCode, generatePairingCode, storePairingCode } from '../lib/pairing';

const PairBody = z.union([
  z.object({ key: z.string().min(1).max(512) }),
  z.object({ code: z.string().min(1).max(64) }),
]);

async function assertValidCredential(
  c: Context<AppEnv>,
  body: z.infer<typeof PairBody>,
  expectedKey: string,
): Promise<void> {
  if ('key' in body) {
    if (!(await safeEqual(body.key.trim(), expectedKey))) {
      throw new HttpError(401, 'invalid_key', 'The access key is not valid');
    }
    return;
  }
  const code = normalizePairingCode(body.code);
  if (!code || !(await claimPairingCode(c.env.DB, code))) {
    throw new HttpError(401, 'invalid_code', 'The code is not valid or has expired');
  }
}

export const authRoutes = new Hono<AppEnv>()
  .get('/status', async (c) => c.json({ paired: await isAuthenticated(c) }))

  /**
   * Exchanges the access key (or a one-time pairing code) for a long-lived
   * session. Browsers on the same origin get it as an HttpOnly cookie; apps on
   * another origin (Android) use the returned `token` as a Bearer token.
   */
  .post('/pair', async (c) => {
    const body = await readJson(c, PairBody);
    // Resolved before touching the database so a missing secret fails closed.
    const expected = getAccessKey(c);
    await assertValidCredential(c, body, expected);
    const token = await createSessionToken(expected);
    setCookie(c, SESSION_COOKIE, token, {
      httpOnly: true,
      // Browsers treat http://localhost as secure, but curl does not: only
      // require HTTPS when we are actually served over HTTPS.
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_S,
    });
    return c.json({ paired: true, token });
  })

  /** One active code, valid 10 minutes, to link another device without typing the key. */
  .post('/pairing-codes', requireAuth, async (c) => {
    const code = generatePairingCode();
    const expiresAt = await storePairingCode(c.env.DB, code);
    return c.json({ code, expiresAt }, 201);
  })

  .post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ paired: false });
  });
