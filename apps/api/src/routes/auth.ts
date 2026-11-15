import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { SESSION_COOKIE } from '@aske/shared';
import type { AppEnv } from '../env';
import { getAccessKey, isAuthenticated } from '../lib/auth';
import { createSessionToken, safeEqual, SESSION_MAX_AGE_S } from '../lib/crypto';
import { HttpError, readJson } from '../lib/http';

const PairBody = z.object({ key: z.string().min(1).max(512) });

export const authRoutes = new Hono<AppEnv>()
  .get('/status', async (c) => c.json({ paired: await isAuthenticated(c) }))

  /** Exchanges the access key for a long-lived, HttpOnly session cookie. */
  .post('/pair', async (c) => {
    const { key } = await readJson(c, PairBody);
    const expected = getAccessKey(c);
    if (!(await safeEqual(key.trim(), expected))) {
      throw new HttpError(401, 'invalid_key', 'The access key is not valid');
    }
    setCookie(c, SESSION_COOKIE, await createSessionToken(expected), {
      httpOnly: true,
      // Browsers treat http://localhost as secure, but curl does not: only
      // require HTTPS when we are actually served over HTTPS.
      secure: new URL(c.req.url).protocol === 'https:',
      sameSite: 'Strict',
      path: '/',
      maxAge: SESSION_MAX_AGE_S,
    });
    return c.json({ paired: true });
  })

  .post('/logout', (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: '/' });
    return c.json({ paired: false });
  });
