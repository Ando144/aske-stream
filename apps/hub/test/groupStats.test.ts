import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  oldestKeptMonth,
  shiftMonthKey,
  utcMonthKey,
  type GroupDetail,
  type GroupStats,
  type MonthStats,
} from '@aske/shared/groups';
import { cleanupGroups } from '../src/groups/cleanup';
import { createGroupRoutes } from '../src/groups/routes';
import { HubHttpError } from '../src/lib/http';
import { FakeD1 } from './fakeDb';
import { MemoryGroupRepo } from './memoryGroupRepo';

const key = (n: number) => n.toString(16).padStart(64, '0');
const thisMonth = utcMonthKey(Date.now());

function stats(month: string, track = 'Song', plays = 3): MonthStats {
  return {
    month,
    minutes: plays * 3,
    plays,
    topTracks: [{ title: track, artist: 'Artist', plays, minutes: plays * 3 }],
    topArtists: [{ artist: 'Artist', plays, minutes: plays * 3 }],
  };
}

function setup() {
  const repo = new MemoryGroupRepo();
  const db = new FakeD1();
  const app = new Hono();
  app.route(
    '/hub/v1/groups',
    createGroupRoutes(() => repo),
  );
  app.onError((err, c) =>
    err instanceof HubHttpError
      ? c.json({ error: err.code }, err.status)
      : c.json({ error: 'internal_error' }, 500),
  );
  const call = (device: number, method: string, path: string, body?: unknown) =>
    app.request(
      `/hub/v1/groups${path}`,
      {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Device-Key': key(device) },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      { DB: db },
    );
  const put = (device: number, months: unknown[]) => call(device, 'PUT', '/stats', { months });
  const group = async (device: number, name = 'G') =>
    (await (await call(device, 'POST', '', { name, alias: `u${device}` })).json()) as GroupDetail;
  const join = (device: number, code: string) =>
    call(device, 'POST', '/join', { code, alias: `u${device}` });
  return { repo, db, call, put, group, join };
}

describe('PUT /stats', () => {
  it('accepts up to 12 months in one upload and replaces a month', async () => {
    const { put, group, repo } = setup();
    await group(1);
    const months = Array.from({ length: 12 }, (_, i) => stats(shiftMonthKey(thisMonth, -i)));
    expect((await put(1, months)).status).toBe(204);
    expect(repo.stats.size).toBe(12);
    await put(1, [stats(thisMonth, 'Other')]);
    expect(repo.stats.size).toBe(12);
    const saved = [...repo.stats.values()].filter((s) => s.statsJson.includes('Other'));
    expect(saved).toHaveLength(1);
  });

  it('rejects more than 12 months, repeated months and months out of range', async () => {
    const { put, group } = setup();
    await group(1);
    const thirteen = Array.from({ length: 13 }, (_, i) => stats(shiftMonthKey(thisMonth, -i)));
    expect((await put(1, thirteen)).status).toBe(400);
    expect((await put(1, [stats(thisMonth), stats(thisMonth)])).status).toBe(400);
    expect((await put(1, [stats(shiftMonthKey(thisMonth, -12))])).status).toBe(204);
    expect((await put(1, [stats(shiftMonthKey(thisMonth, 2))])).status).toBe(400);
    expect((await put(1, [])).status).toBe(400);
    expect((await put(1, [{ month: 'nope' }])).status).toBe(400);
  });

  it('rejects an oversized body', async () => {
    const { put, group } = setup();
    await group(1);
    const res = await put(1, [{ ...stats(thisMonth), padding: 'x'.repeat(70 * 1024) }]);
    expect(res.status).toBe(413);
  });

  it('stores nothing for a device that is in no group', async () => {
    const { put, repo } = setup();
    expect((await put(1, [stats(thisMonth)])).status).toBe(204);
    expect(repo.stats.size).toBe(0);
  });
});

describe('GET /:id/stats', () => {
  it('returns only members of the group and a summed ranking', async () => {
    const { put, group, join, call } = setup();
    const g = await group(1);
    await join(2, g.inviteCode);
    await group(3);
    await put(1, [stats(thisMonth, 'Song', 5)]);
    await put(2, [stats(thisMonth, 'song ', 2)]);
    await put(3, [stats(thisMonth, 'Stranger', 99)]);
    const res = await call(1, 'GET', `/${g.id}/stats?month=${thisMonth}`);
    const body = (await res.json()) as GroupStats;
    expect(body.members.map((m) => m.alias)).toEqual(['u1', 'u2']);
    expect(body.ranking.tracks).toEqual([
      { title: 'Song', artist: 'Artist', plays: 7, listeners: 2 },
    ]);
    expect(body.ranking.artists[0]).toMatchObject({ plays: 7, listeners: 2 });
  });

  it('skips members who did not upload that month and defaults to this month', async () => {
    const { put, group, join, call } = setup();
    const g = await group(1);
    await join(2, g.inviteCode);
    await put(2, [stats(thisMonth)]);
    const body = (await (await call(1, 'GET', `/${g.id}/stats`)).json()) as GroupStats;
    expect(body.month).toBe(thisMonth);
    expect(body.members.map((m) => m.alias)).toEqual(['u2']);
  });

  it('refuses months older than 12 and invalid ones, and non members', async () => {
    const { group, call } = setup();
    const g = await group(1);
    const old = shiftMonthKey(thisMonth, -12);
    expect((await call(1, 'GET', `/${g.id}/stats?month=${old}`)).status).toBe(400);
    expect((await call(1, 'GET', `/${g.id}/stats?month=abc`)).status).toBe(400);
    expect((await call(2, 'GET', `/${g.id}/stats`)).status).toBe(403);
  });
});

describe('DELETE /stats', () => {
  it('removes only the stats and keeps the groups', async () => {
    const { put, group, call, repo } = setup();
    await group(1);
    await put(1, [stats(thisMonth)]);
    expect((await call(1, 'DELETE', '/stats')).status).toBe(204);
    expect(repo.stats.size).toBe(0);
    const mine = (await (await call(1, 'GET', '')).json()) as { groups: unknown[] };
    expect(mine.groups).toHaveLength(1);
  });
});

describe('cleanupGroups', () => {
  it('drops months older than the oldest kept one and keeps the last 12', async () => {
    const calls: Array<{ sql: string; args: unknown[] }> = [];
    const stmt = (sql: string) => ({
      bind: (...args: unknown[]) => {
        calls.push({ sql, args });
        return { sql, args };
      },
      sql,
      args: [] as unknown[],
    });
    const db = { prepare: stmt, batch: async () => [] } as unknown as D1Database;
    const now = Date.UTC(2026, 10, 23);
    await cleanupGroups(db, now);
    const months = calls.find((c) => c.sql.includes('FROM device_stats WHERE month <'));
    expect(months?.args).toEqual([oldestKeptMonth(now)]);
    expect(oldestKeptMonth(now)).toBe('2025-12');
    const idle = calls.find((c) => c.sql.startsWith('DELETE FROM groups WHERE'));
    expect(idle?.args[0]).toBe(now - 180 * 24 * 3600 * 1000);
  });
});
