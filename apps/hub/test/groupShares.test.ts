import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { GroupDetail, GroupShare } from '@aske/shared/groups';
import { createGroupRoutes } from '../src/groups/routes';
import { HubHttpError } from '../src/lib/http';
import { FakeD1 } from './fakeDb';
import { MemoryGroupRepo } from './memoryGroupRepo';

const key = (n: number) => n.toString(16).padStart(64, '0');
const LIST_ID = 'ABCDEFGHJK';
const HOUR = 3600 * 1000;

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
  const group = async (device: number) =>
    (await (
      await call(device, 'POST', '', { name: 'G', alias: `u${device}` })
    ).json()) as GroupDetail;
  const join = (device: number, code: string) =>
    call(device, 'POST', '/join', { code, alias: `u${device}` });
  const share = (device: number, id: string, body: unknown) =>
    call(device, 'POST', `/${id}/shares`, body);
  return { repo, db, call, group, join, share };
}

describe('shares', () => {
  it('shares a list that expires together with its link', async () => {
    const { repo, group, share, call } = setup();
    const g = await group(1);
    const expiresAt = Date.now() + 5 * HOUR;
    repo.lists.set(LIST_ID, expiresAt);
    const res = await share(1, g.id, { kind: 'list', ref: LIST_ID, title: 'Road trip' });
    expect(res.status).toBe(201);
    const made = (await res.json()) as GroupShare;
    expect(made).toMatchObject({ kind: 'list', ref: LIST_ID, alias: 'u1', expiresAt });
    const listed = (await (await call(1, 'GET', `/${g.id}/shares`)).json()) as {
      shares: GroupShare[];
    };
    expect(listed.shares).toHaveLength(1);
  });

  it('answers 404 for a list link that does not exist or has expired', async () => {
    const { repo, group, share } = setup();
    const g = await group(1);
    expect((await share(1, g.id, { kind: 'list', ref: LIST_ID, title: 'x' })).status).toBe(404);
    repo.lists.set(LIST_ID, Date.now() - 1);
    expect((await share(1, g.id, { kind: 'list', ref: LIST_ID, title: 'x' })).status).toBe(404);
  });

  it('gives a Jam share a 12 hour life and normalizes its code', async () => {
    const { group, share } = setup();
    const g = await group(1);
    const before = Date.now();
    const res = await share(1, g.id, { kind: 'jam', ref: 'abc-234', title: 'Party' });
    const made = (await res.json()) as GroupShare;
    expect(made.ref).toBe('ABC234');
    expect(made.expiresAt).toBeGreaterThanOrEqual(before + 12 * HOUR);
    expect(made.expiresAt).toBeLessThanOrEqual(Date.now() + 12 * HOUR);
    expect((await share(1, g.id, { kind: 'jam', ref: 'no', title: 'Party' })).status).toBe(400);
  });

  it('never keeps more than 50 shares', async () => {
    const { repo, group, share, db } = setup();
    const g = await group(1);
    for (let i = 0; i < 52; i++) {
      db.limits.clear();
      await share(1, g.id, { kind: 'jam', ref: 'ABC234', title: `Jam ${i}` });
    }
    expect(repo.shares.filter((s) => s.groupId === g.id)).toHaveLength(50);
  });

  it('keeps shares away from non members', async () => {
    const { group, share, call } = setup();
    const g = await group(1);
    const res = await share(2, g.id, { kind: 'jam', ref: 'ABC234', title: 'x' });
    expect(res.status).toBe(403);
    expect((await call(2, 'GET', `/${g.id}/shares`)).status).toBe(403);
  });

  it('lets the author or the owner delete, but not another member', async () => {
    const { group, join, share, call } = setup();
    const g = await group(1);
    await join(2, g.inviteCode);
    await join(3, g.inviteCode);
    const made = (await (
      await share(2, g.id, { kind: 'jam', ref: 'ABC234', title: 'x' })
    ).json()) as GroupShare;
    expect((await call(3, 'DELETE', `/${g.id}/shares/${made.id}`)).status).toBe(403);
    expect((await call(2, 'DELETE', `/${g.id}/shares/${made.id}`)).status).toBe(204);
    const again = (await (
      await share(2, g.id, { kind: 'jam', ref: 'ABC234', title: 'y' })
    ).json()) as GroupShare;
    expect((await call(1, 'DELETE', `/${g.id}/shares/${again.id}`)).status).toBe(204);
    expect((await call(1, 'DELETE', `/${g.id}/shares/${again.id}`)).status).toBe(404);
  });

  it('rejects a bad body', async () => {
    const { group, share } = setup();
    const g = await group(1);
    expect((await share(1, g.id, { kind: 'song', ref: 'x', title: 'x' })).status).toBe(400);
    expect((await share(1, g.id, { kind: 'jam', ref: 'ABC234', title: ' ' })).status).toBe(400);
  });
});
