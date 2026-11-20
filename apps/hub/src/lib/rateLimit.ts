import type { Context } from 'hono';
import { sha256Hex } from './crypto';
import { HubHttpError } from './http';

/**
 * Fixed-window counter in D1. Returns false once `limit` is exceeded in the
 * current window. Windows are aligned to multiples of `windowMs`.
 */
export async function checkRateLimit(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): Promise<boolean> {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const row = await db
    .prepare(
      `INSERT INTO rate_limits (key, window_start, count) VALUES (?1, ?2, 1)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN window_start < ?2 THEN 1 ELSE count + 1 END,
         window_start = ?2
       RETURNING count`,
    )
    .bind(key, windowStart)
    .first<{ count: number }>();
  return (row?.count ?? 1) <= limit;
}

/** `action:sha256(ip + UTC day)`: the IP is never stored, and the salt changes daily. */
export async function rateLimitKey(c: Context, action: string, now = Date.now()): Promise<string> {
  const ip = c.req.header('CF-Connecting-IP') ?? 'unknown';
  const day = new Date(now).toISOString().slice(0, 10);
  return `${action}:${await sha256Hex(`${ip}${day}`)}`;
}

/** Throws 429 when the caller exceeded `limit` requests per `windowMs`. */
export async function enforceRateLimit(
  c: Context,
  db: D1Database,
  action: string,
  limit: number,
  windowMs: number,
): Promise<void> {
  const key = await rateLimitKey(c, action);
  if (!(await checkRateLimit(db, key, limit, windowMs))) {
    throw new HubHttpError(429, 'rate_limited', 'Too many requests, try again later');
  }
}
