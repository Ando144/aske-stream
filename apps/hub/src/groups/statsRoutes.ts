import { Hono } from 'hono';
import { z } from 'zod';
import {
  GROUP_LIMITS,
  isAcceptableMonth,
  isMonthKey,
  oldestKeptMonth,
  sanitizeMonthStats,
  shiftMonthKey,
  utcMonthKey,
  type GroupStats,
  type MemberMonthStats,
  type MonthStats,
} from '@aske/shared/groups';
import type { HubAppEnv } from '../env';
import { enforceRateLimit } from '../lib/rateLimit';
import { deviceHashOf, invalidRequest, readJsonBody, requireMember, type RepoFor } from './auth';
import { buildGroupRanking } from './ranking';

const HOUR_MS = 3600 * 1000;
const TEN_MIN_MS = 600 * 1000;

const UploadBody = z.object({ months: z.array(z.unknown()) });

function parseUpload(raw: unknown, now: number): MonthStats[] {
  const parsed = UploadBody.safeParse(raw);
  const count = parsed.success ? parsed.data.months.length : 0;
  if (!parsed.success || count < 1 || count > GROUP_LIMITS.statsMaxMonthsPerUpload) {
    throw invalidRequest('Send between 1 and 12 months');
  }
  const seen = new Set<string>();
  const oldest = oldestKeptMonth(now);
  const kept: MonthStats[] = [];
  for (const item of parsed.data.months) {
    const stats = sanitizeMonthStats(item);
    if (!stats || !isMonthKey(stats.month) || seen.has(stats.month)) {
      throw invalidRequest('A month is not valid');
    }
    seen.add(stats.month);
    // A phone behind UTC can still hold a month that just aged out; drop it quietly.
    if (stats.month < oldest) continue;
    if (!isAcceptableMonth(stats.month, now)) throw invalidRequest('A month is not valid');
    kept.push(stats);
  }
  return kept;
}

function parseMonthQuery(raw: string | undefined, now: number): string {
  const month = raw ?? utcMonthKey(now);
  if (
    !isMonthKey(month) ||
    month < oldestKeptMonth(now) ||
    month > shiftMonthKey(utcMonthKey(now), 1)
  ) {
    throw invalidRequest('That month is not available');
  }
  return month;
}

export function createStatsRoutes(repoFor: RepoFor): Hono<HubAppEnv> {
  const app = new Hono<HubAppEnv>();

  app.put('/stats', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_stats', 30, HOUR_MS);
    const now = Date.now();
    const months = parseUpload(await readJsonBody(c.req.raw, GROUP_LIMITS.statsBodyMaxBytes), now);
    const repo = repoFor(c.env);
    const mine = await repo.groupsOfDevice(deviceHash);
    if (mine.length === 0) return c.body(null, 204);
    for (const stats of months) {
      await repo.putStats(deviceHash, stats.month, JSON.stringify(stats), now);
    }
    for (const { group } of mine) await repo.touchGroup(group.id, now);
    return c.body(null, 204);
  });

  app.delete('/stats', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_erase', 20, TEN_MIN_MS);
    await repoFor(c.env).deleteStats(deviceHash);
    return c.body(null, 204);
  });

  app.get('/:id/stats', async (c) => {
    const deviceHash = await deviceHashOf(c);
    await enforceRateLimit(c, c.env.DB, 'group_read', 300, TEN_MIN_MS);
    const repo = repoFor(c.env);
    const { group } = await requireMember(repo, c.req.param('id'), deviceHash);
    const month = parseMonthQuery(c.req.query('month'), Date.now());
    const members = await memberStats(repo, group.id, month);
    const result: GroupStats = {
      month,
      members,
      ranking: buildGroupRanking(members, GROUP_LIMITS.topSize),
    };
    return c.json(result);
  });

  return app;
}

async function memberStats(
  repo: ReturnType<RepoFor>,
  groupId: string,
  month: string,
): Promise<MemberMonthStats[]> {
  const rows = await repo.statsForGroup(groupId, month);
  const out: MemberMonthStats[] = [];
  for (const row of rows) {
    const stats = sanitizeMonthStats(JSON.parse(row.statsJson));
    if (stats) out.push({ ...stats, memberId: row.memberId, alias: row.alias });
  }
  return out.sort((a, b) => b.minutes - a.minutes || a.alias.localeCompare(b.alias));
}
