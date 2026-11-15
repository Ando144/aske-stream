import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE } from '@aske/shared';
import type { AppEnv } from '../env';
import { safeEqual, verifySessionToken } from './crypto';
import { HttpError } from './http';

/** Long random keys only: a short key would make the single-owner model guessable. */
export const MIN_KEY_LENGTH = 24;

export function getAccessKey(c: Context<AppEnv>): string {
  const key = c.env.ACCESS_KEY;
  if (!key || key.length < MIN_KEY_LENGTH) {
    // Fail closed: a missing secret must never mean "open to everyone".
    throw new HttpError(
      500,
      'not_configured',
      `ACCESS_KEY secret is missing or shorter than ${MIN_KEY_LENGTH} characters`,
    );
  }
  return key;
}

export async function isAuthenticated(c: Context<AppEnv>): Promise<boolean> {
  const key = getAccessKey(c);

  // 1. CLI: the access key itself. 2. Apps on another origin (Android): a device token.
  const header = c.req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    const bearer = header.slice('Bearer '.length).trim();
    if (bearer.startsWith('v1.')) return verifySessionToken(key, bearer);
    return safeEqual(bearer, key);
  }

  // 3. <audio src> cannot send headers, so media URLs may carry the device token.
  const queryToken = c.req.query('t');
  if (queryToken && new URL(c.req.url).pathname.startsWith('/media/')) {
    return verifySessionToken(key, queryToken);
  }

  // 4. Same-origin browser: HttpOnly cookie.
  const cookie = getCookie(c, SESSION_COOKIE);
  return cookie ? verifySessionToken(key, cookie) : false;
}

/**
 * Single-owner authentication. There are no user accounts: either the
 * request carries the access key (CLI), a device token signed with it
 * (Android app, other origins) or the same token as a cookie (paired browser).
 * Cookies are SameSite=Strict, so cross-site requests never carry them; device
 * tokens are only ever sent explicitly by our own app, so no CSRF token is needed.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!(await isAuthenticated(c))) {
    throw new HttpError(401, 'unauthorized', 'This device is not paired');
  }
  await next();
};
