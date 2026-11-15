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

  const header = c.req.header('authorization');
  if (header?.startsWith('Bearer ')) {
    return safeEqual(header.slice('Bearer '.length).trim(), key);
  }

  const cookie = getCookie(c, SESSION_COOKIE);
  return cookie ? verifySessionToken(key, cookie) : false;
}

/**
 * Single-owner authentication. There are no user accounts: either the
 * request carries the access key (CLI) or a cookie signed with it (paired
 * browser). Cookies are SameSite=Strict, so cross-site requests never carry
 * them and no extra CSRF token is needed.
 */
export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!(await isAuthenticated(c))) {
    throw new HttpError(401, 'unauthorized', 'This device is not paired');
  }
  await next();
};
