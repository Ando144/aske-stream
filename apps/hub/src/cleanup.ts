import type { HubEnv } from './env';

const DAY_MS = 24 * 3600 * 1000;

/** Drops expired shared lists and rate-limit rows older than a day. */
export async function cleanup(env: Pick<HubEnv, 'DB'>, now: number): Promise<void> {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM shared_lists WHERE expires_at < ?').bind(now),
    env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(now - DAY_MS),
  ]);
}
