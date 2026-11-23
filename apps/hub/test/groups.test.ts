import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import type { GroupDetail } from '@aske/shared/groups';
import { createGroupRoutes } from '../src/groups/routes';
import { HubHttpError } from '../src/lib/http';
import { FakeD1 } from './fakeDb';
import { MemoryGroupRepo } from './memoryGroupRepo';

const key = (n: number) => n.toString(16).padStart(64, '0');
const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;

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
      ? c.json({ error: err.code, message: err.message }, err.status)
      : c.json({ error: 'internal_error' }, 500),
  );
  const call = (device: number | string | null, method: string, path: string, body?: unknown) =>
    app.request(
      `/hub/v1/groups${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(device === null
            ? {}
            : { 'X-Device-Key': typeof device === 'number' ? key(device) : device }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      },
      { DB: db },
    );
  const create = async (device: number, name = 'Friends') =>
    (await (
      await call(device, 'POST', '', { name, alias: `user${device}` })
    ).json()) as GroupDetail;
  const join = (device: number, code: string) =>
    call(device, 'POST', '/join', { code, alias: `user${device}` });
  return { repo, db, call, create, join };
}

describe('create, join and read', () => {
  it('creates a group and lists it for its owner only', async () => {
    const { call } = setup();
    const res = await call(1, 'POST', '', { name: ' Friends ', alias: 'Ana' });
    expect(res.status).toBe(201);
    const detail = (await res.json()) as GroupDetail;
    expect(detail).toMatchObject({ name: 'Friends', isOwner: true });
    expect(detail.inviteCode).toHaveLength(8);
    expect(detail.members).toHaveLength(1);
    const mine = (await (await call(1, 'GET', '')).json()) as { groups: unknown[] };
    const other = (await (await call(2, 'GET', '')).json()) as { groups: unknown[] };
    expect(mine.groups).toHaveLength(1);
    expect(other.groups).toHaveLength(0);
  });

  it('never stores the device key itself', async () => {
    const { repo, create } = setup();
    await create(1);
    expect(repo.members[0]!.deviceHash).not.toBe(key(1));
    expect(repo.members[0]!.deviceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('joins with a lowercase code and lets the new member see the group', async () => {
    const { call, create, join } = setup();
    const group = await create(1);
    const res = await join(2, group.inviteCode.toLowerCase());
    expect(res.status).toBe(200);
    const joined = (await res.json()) as GroupDetail;
    expect(joined.isOwner).toBe(false);
    expect(joined.members).toHaveLength(2);
    expect((await call(2, 'GET', `/${group.id}`)).status).toBe(200);
  });

  it('updates the alias when a member joins again', async () => {
    const { call, create } = setup();
    const group = await create(1);
    const res = await call(1, 'POST', '/join', { code: group.inviteCode, alias: 'Nuevo' });
    const detail = (await res.json()) as GroupDetail;
    expect(detail.members).toHaveLength(1);
    expect(detail.members[0]!.alias).toBe('Nuevo');
  });

  it('answers 404 group_not_found for an unknown code', async () => {
    const { join } = setup();
    const res = await join(1, 'ABCDEFGH');
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe('group_not_found');
  });

  it('refuses the 21st member with 409 group_full', async () => {
    const { create, join } = setup();
    const group = await create(1);
    for (let n = 2; n <= 20; n++) expect((await join(n, group.inviteCode)).status).toBe(200);
    const res = await join(21, group.inviteCode);
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe('group_full');
  });

  it('refuses an 11th group for one device', async () => {
    const { call, create, db } = setup();
    for (let i = 0; i < 10; i++) await create(1, `G${i}`);
    db.limits.clear();
    const res = await call(1, 'POST', '', { name: 'one more', alias: 'Ana' });
    expect(res.status).toBe(409);
    expect(await errorOf(res)).toBe('too_many_groups');
  });

  it('rejects invalid names and aliases with 400', async () => {
    const { call } = setup();
    expect((await call(1, 'POST', '', { name: '  ', alias: 'Ana' })).status).toBe(400);
    expect((await call(1, 'POST', '', { name: 'ok', alias: 'x'.repeat(40) })).status).toBe(400);
  });

  it('rejects a missing, short or non-hex device key with 400', async () => {
    const { call } = setup();
    expect((await call(null, 'GET', '')).status).toBe(400);
    expect((await call('zz', 'GET', '')).status).toBe(400);
    expect((await call('g'.repeat(64), 'GET', '')).status).toBe(400);
  });
});

describe('non members', () => {
  it('get 403 not_member on detail and invite', async () => {
    const { call, create } = setup();
    const group = await create(1);
    const detail = await call(2, 'GET', `/${group.id}`);
    expect(detail.status).toBe(403);
    expect(await errorOf(detail)).toBe('not_member');
    expect((await call(2, 'POST', `/${group.id}/invite`)).status).toBe(403);
  });

  it('get 404 for a group that does not exist', async () => {
    const { call } = setup();
    expect((await call(1, 'GET', '/ABCDEFGHJK')).status).toBe(404);
  });
});

describe('invite code', () => {
  it('is renewed by the owner and the old code stops working', async () => {
    const { call, create, join } = setup();
    const group = await create(1);
    const res = await call(1, 'POST', `/${group.id}/invite`);
    const { inviteCode } = (await res.json()) as { inviteCode: string };
    expect(inviteCode).not.toBe(group.inviteCode);
    expect((await join(2, group.inviteCode)).status).toBe(404);
    expect((await join(2, inviteCode)).status).toBe(200);
  });

  it('cannot be renewed by a plain member', async () => {
    const { call, create, join } = setup();
    const group = await create(1);
    await join(2, group.inviteCode);
    const res = await call(2, 'POST', `/${group.id}/invite`);
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe('not_owner');
  });
});

describe('leaving and kicking', () => {
  it('hands the group to the oldest member when the owner leaves', async () => {
    const { call, create, join, repo } = setup();
    const group = await create(1);
    await join(2, group.inviteCode);
    await join(3, group.inviteCode);
    repo.members[1]!.joinedAt = repo.members[0]!.joinedAt + 1;
    repo.members[2]!.joinedAt = repo.members[0]!.joinedAt + 2;
    expect((await call(1, 'DELETE', `/${group.id}/members/${group.you}`)).status).toBe(204);
    const detail = (await (await call(2, 'GET', `/${group.id}`)).json()) as GroupDetail;
    expect(detail.isOwner).toBe(true);
    expect(detail.members).toHaveLength(2);
  });

  it('deletes the group when the last member leaves', async () => {
    const { call, create } = setup();
    const group = await create(1);
    expect((await call(1, 'DELETE', `/${group.id}/members/${group.you}`)).status).toBe(204);
    expect((await call(1, 'GET', `/${group.id}`)).status).toBe(404);
  });

  it('lets the owner kick and the kicked device cannot come back', async () => {
    const { call, create, join } = setup();
    const group = await create(1);
    const joined = (await (await join(2, group.inviteCode)).json()) as GroupDetail;
    expect((await call(1, 'DELETE', `/${group.id}/members/${joined.you}`)).status).toBe(204);
    const again = await join(2, group.inviteCode);
    expect(again.status).toBe(403);
    expect(await errorOf(again)).toBe('kicked');
  });

  it('does not let a member kick someone else', async () => {
    const { call, create, join } = setup();
    const group = await create(1);
    await join(2, group.inviteCode);
    const res = await call(2, 'DELETE', `/${group.id}/members/${group.you}`);
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe('not_owner');
  });

  it('answers 404 when the member to kick does not exist', async () => {
    const { call, create } = setup();
    const group = await create(1);
    expect((await call(1, 'DELETE', `/${group.id}/members/NOPENOPENO`)).status).toBe(404);
  });
});

describe('delete all my group data', () => {
  it('leaves every group and removes the stats, but others stay', async () => {
    const { call, create, join, repo } = setup();
    const a = await create(1, 'A');
    await create(1, 'B');
    await join(2, a.inviteCode);
    repo.stats.set(`${repo.members[0]!.deviceHash}|2026-11`, { statsJson: '{}', updatedAt: 1 });
    expect((await call(1, 'DELETE', '/me')).status).toBe(204);
    const mine = (await (await call(1, 'GET', '')).json()) as { groups: unknown[] };
    expect(mine.groups).toHaveLength(0);
    expect(repo.stats.size).toBe(0);
    expect((await call(2, 'GET', `/${a.id}`)).status).toBe(200);
  });
});

describe('rate limits', () => {
  it('stops group creation after 10 per hour', async () => {
    const { call } = setup();
    let last = 0;
    for (let n = 1; n <= 11; n++) {
      last = (await call(n, 'POST', '', { name: 'x', alias: 'a' })).status;
    }
    expect(last).toBe(429);
  });
});
