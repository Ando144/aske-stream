import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  GROUP_LIMITS,
  shiftMonthKey,
  utcMonthKey,
  type GroupDetail,
  type GroupPreview,
  type GroupSummary,
  type MonthStats,
} from '@aske/shared/groups';
import { createGroupRoutes } from '../src/groups/routes';
import { cardMonth, isJpeg } from '../src/groups/service';
import { HubHttpError } from '../src/lib/http';
import { FakeD1 } from './fakeDb';
import { MemoryGroupRepo } from './memoryGroupRepo';

const key = (n: number) => n.toString(16).padStart(64, '0');
const errorOf = async (res: Response) => ((await res.json()) as { error: string }).error;
const thisMonth = utcMonthKey(Date.now());
const lastMonth = shiftMonthKey(thisMonth, -1);

function jpeg(size = 16, fill = 1): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(size).fill(fill);
  bytes.set([0xff, 0xd8, 0xff]);
  bytes.set([0xff, 0xd9], size - 2);
  return bytes;
}

/** A body without a known length, which also tells how much of it was actually read. */
function chunked(bytes: Uint8Array<ArrayBuffer>, chunkSize: number) {
  let sent = 0;
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent >= bytes.length) return controller.close();
      const chunk = bytes.slice(sent, sent + chunkSize);
      sent += chunk.length;
      controller.enqueue(chunk);
    },
    cancel() {
      cancelled = true;
    },
  });
  return { stream, sent: () => sent, cancelled: () => cancelled };
}

function stats(minutes: number, month = thisMonth): MonthStats {
  return { month, minutes, plays: 1, topTracks: [], topArtists: [] };
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
  const send = (device: number, method: string, path: string, init: RequestInit = {}) =>
    app.request(
      `/hub/v1/groups${path}`,
      { ...init, method, headers: { 'X-Device-Key': key(device), ...init.headers } },
      { DB: db },
    );
  const call = (device: number, method: string, path: string, body?: unknown) =>
    send(device, method, path, {
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const upload = (
    device: number,
    id: string,
    body: Uint8Array<ArrayBuffer>,
    headers: Record<string, string> = {},
  ) =>
    send(device, 'PUT', `/${id}/photo`, {
      headers: { 'Content-Type': 'image/jpeg', ...headers },
      body,
    });
  const uploadStream = (device: number, id: string, body: ReadableStream<Uint8Array>) => {
    // Node needs `duplex` to send a stream, and the DOM types do not know about it.
    const init = { headers: { 'Content-Type': 'image/jpeg' }, body, duplex: 'half' };
    return send(device, 'PUT', `/${id}/photo`, init);
  };
  const create = async (device: number, name = 'Friends') =>
    (await (await call(device, 'POST', '', { name, alias: `u${device}` })).json()) as GroupDetail;
  const join = (device: number, code: string) =>
    call(device, 'POST', '/join', { code, alias: `u${device}` });
  /** A group of device 1 where the others join one after another. */
  const crowd = async (others: number[]) => {
    const group = await create(1);
    for (const device of others) await join(device, group.inviteCode);
    repo.members.forEach((m, i) => (m.joinedAt = 1000 + i));
    return group;
  };
  const list = async (device: number, query = '') =>
    ((await (await call(device, 'GET', query)).json()) as { groups: GroupSummary[] }).groups;
  return { repo, db, call, send, upload, uploadStream, create, join, crowd, list };
}

describe('cardMonth', () => {
  const row = (alias: string, statsJson: string) => ({ memberId: alias, alias, statsJson });

  it('is empty when nobody shares', () => {
    expect(cardMonth([], '2026-11')).toEqual({
      month: '2026-11',
      minutes: 0,
      sharing: 0,
      topAlias: null,
    });
  });

  it('adds the minutes and names who listens most', () => {
    const rows = [
      row('ana', JSON.stringify(stats(10, '2026-11'))),
      row('bea', JSON.stringify(stats(30, '2026-11'))),
    ];
    expect(cardMonth(rows, '2026-11')).toMatchObject({ minutes: 40, sharing: 2, topAlias: 'bea' });
  });

  it('gives a tie to whoever joined first', () => {
    const rows = [
      row('ana', JSON.stringify(stats(10, '2026-11'))),
      row('bea', JSON.stringify(stats(10, '2026-11'))),
    ];
    expect(cardMonth(rows, '2026-11').topAlias).toBe('ana');
  });

  it('names nobody when every shared month has zero minutes', () => {
    const rows = [row('ana', JSON.stringify(stats(0, '2026-11')))];
    expect(cardMonth(rows, '2026-11')).toMatchObject({ sharing: 1, topAlias: null });
  });

  it('skips broken or invalid rows', () => {
    const rows = [
      row('ana', '{broken'),
      row('bea', '{"month":"nope"}'),
      row('cris', JSON.stringify(stats(5, '2026-11'))),
    ];
    expect(cardMonth(rows, '2026-11')).toMatchObject({ minutes: 5, sharing: 1, topAlias: 'cris' });
  });
});

describe('isJpeg', () => {
  it('needs both the start and the end markers', () => {
    expect(isJpeg(jpeg())).toBe(true);
    expect(isJpeg(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0xff, 0xd9]))).toBe(false);
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0x00, 0x00]))).toBe(false);
    expect(isJpeg(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]))).toBe(false);
    expect(isJpeg(new Uint8Array())).toBe(false);
  });
});

describe('group list cards', () => {
  it('returns up to four people, oldest first, and the asked month', async () => {
    const { crowd, list, repo } = setup();
    await crowd([2, 3, 4, 5]);
    await repo.putStats(
      repo.members[1]!.deviceHash,
      lastMonth,
      JSON.stringify(stats(7, lastMonth)),
      1,
    );
    const [card] = await list(1, `?month=${lastMonth}`);
    expect(card!.people).toEqual(['u1', 'u2', 'u3', 'u4']);
    expect(card!.members).toBe(5);
    expect(card!.photoAt).toBeNull();
    expect(card!.month).toEqual({ month: lastMonth, minutes: 7, sharing: 1, topAlias: 'u2' });
  });

  it('never counts or names someone who does not share', async () => {
    const { crowd, list, repo } = setup();
    await crowd([2]);
    await repo.putStats(repo.members[1]!.deviceHash, thisMonth, JSON.stringify(stats(3)), 1);
    const [card] = await list(1);
    expect(card!.people).toEqual(['u1', 'u2']);
    expect(card!.month).toEqual({ month: thisMonth, minutes: 3, sharing: 1, topAlias: 'u2' });
  });

  it('falls back to the current UTC month for a missing or invalid month', async () => {
    const { create, list } = setup();
    await create(1);
    for (const query of ['', '?month=abc', '?month=1999-01', '?month=']) {
      const [card] = await list(1, query);
      expect(card!.month?.month).toBe(thisMonth);
    }
  });
});

describe('changing the name', () => {
  it('lets any member rename and the last change wins', async () => {
    const { crowd, call, repo } = setup();
    const group = await crowd([2]);
    repo.groups.get(group.id)!.lastActiveAt = 1;
    expect((await call(1, 'PUT', `/${group.id}/name`, { name: 'First' })).status).toBe(200);
    const res = await call(2, 'PUT', `/${group.id}/name`, { name: '  Second ' });
    expect(res.status).toBe(200);
    const detail = (await res.json()) as GroupDetail;
    expect(detail).toMatchObject({ name: 'Second', photoAt: null, isOwner: false });
    expect(detail.members).toHaveLength(2);
    expect(repo.groups.get(group.id)!.name).toBe('Second');
    expect(repo.groups.get(group.id)!.lastActiveAt).toBeGreaterThan(1);
  });

  it('refuses an empty name and a non member', async () => {
    const { create, call } = setup();
    const group = await create(1);
    expect((await call(1, 'PUT', `/${group.id}/name`, { name: '  ' })).status).toBe(400);
    const res = await call(2, 'PUT', `/${group.id}/name`, { name: 'Mine' });
    expect(res.status).toBe(403);
    expect(await errorOf(res)).toBe('not_member');
  });
});

describe('changing the photo', () => {
  it('stores it, serves it privately to members and the last change wins', async () => {
    const { crowd, upload, call, repo, list } = setup();
    const group = await crowd([2]);
    repo.groups.get(group.id)!.lastActiveAt = 1;
    await upload(1, group.id, jpeg(16, 1));
    const res = await upload(2, group.id, jpeg(20, 2));
    expect(res.status).toBe(200);
    const { photoAt } = (await res.json()) as { photoAt: number };
    expect((await list(1))[0]!.photoAt).toBe(photoAt);
    expect(repo.groups.get(group.id)!.lastActiveAt).toBeGreaterThan(1);
    const photo = await call(1, 'GET', `/${group.id}/photo`);
    expect(photo.status).toBe(200);
    expect(photo.headers.get('Content-Type')).toBe('image/jpeg');
    expect(photo.headers.get('Cache-Control')).toBe('private, max-age=86400');
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(jpeg(20, 2));
  });

  it('accepts exactly 100 KB and refuses 101 KB with 413', async () => {
    const { create, upload } = setup();
    const group = await create(1);
    expect((await upload(1, group.id, jpeg(GROUP_LIMITS.photoMaxBytes))).status).toBe(200);
    expect((await upload(1, group.id, jpeg(101 * 1024))).status).toBe(413);
  });

  it('refuses a big Content-Length without reading the body', async () => {
    const { create, upload } = setup();
    const group = await create(1);
    const res = await upload(1, group.id, jpeg(), { 'Content-Length': String(101 * 1024) });
    expect(res.status).toBe(413);
  });

  it('stops reading a big stream without Content-Length and answers 413', async () => {
    const { create, uploadStream, repo } = setup();
    const group = await create(1);
    const source = chunked(jpeg(10 * GROUP_LIMITS.photoMaxBytes), 16 * 1024);
    const res = await uploadStream(1, group.id, source.stream);
    expect(res.status).toBe(413);
    expect(source.sent()).toBeLessThan(2 * GROUP_LIMITS.photoMaxBytes);
    expect(source.cancelled()).toBe(true);
    expect(repo.photos.size).toBe(0);
  });

  it('stores a valid photo sent in chunks without Content-Length', async () => {
    const { create, uploadStream, call } = setup();
    const group = await create(1);
    const photo = jpeg(GROUP_LIMITS.photoMaxBytes, 7);
    const res = await uploadStream(1, group.id, chunked(photo, 16 * 1024).stream);
    expect(res.status).toBe(200);
    const stored = await call(1, 'GET', `/${group.id}/photo`);
    expect(new Uint8Array(await stored.arrayBuffer())).toEqual(photo);
  });

  it('refuses an upload without a body with 400', async () => {
    const { create, send } = setup();
    const group = await create(1);
    const res = await send(1, 'PUT', `/${group.id}/photo`, {
      headers: { 'Content-Type': 'image/jpeg' },
    });
    expect(res.status).toBe(400);
  });

  it('refuses a PNG, unsigned data and a wrong content type with 400', async () => {
    const { create, upload, repo } = setup();
    const group = await create(1);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await upload(1, group.id, png)).status).toBe(400);
    expect((await upload(1, group.id, new Uint8Array(32))).status).toBe(400);
    const wrongType = await upload(1, group.id, jpeg(), { 'Content-Type': 'image/png' });
    expect(wrongType.status).toBe(400);
    expect(await errorOf(wrongType)).toBe('invalid_request');
    expect(repo.photos.size).toBe(0);
  });

  it('answers 404 when there is no photo, also after removing it', async () => {
    const { create, upload, call, list } = setup();
    const group = await create(1);
    const none = await call(1, 'GET', `/${group.id}/photo`);
    expect(none.status).toBe(404);
    expect(await errorOf(none)).toBe('not_found');
    await upload(1, group.id, jpeg());
    expect((await call(1, 'DELETE', `/${group.id}/photo`)).status).toBe(204);
    expect((await call(1, 'GET', `/${group.id}/photo`)).status).toBe(404);
    expect((await list(1))[0]!.photoAt).toBeNull();
  });

  it('refuses non members to upload, read and remove', async () => {
    const { create, upload, call } = setup();
    const group = await create(1);
    await upload(1, group.id, jpeg());
    for (const res of [
      await upload(2, group.id, jpeg()),
      await call(2, 'GET', `/${group.id}/photo`),
      await call(2, 'DELETE', `/${group.id}/photo`),
    ]) {
      expect(res.status).toBe(403);
      expect(await errorOf(res)).toBe('not_member');
    }
  });

  it('stops the 21st edit of one group in an hour, but not another group', async () => {
    const { crowd, create, call, upload } = setup();
    const group = await crowd([2]);
    for (let n = 1; n <= 20; n++) {
      const res = await call((n % 2) + 1, 'PUT', `/${group.id}/name`, { name: `N${n}` });
      expect(res.status).toBe(200);
    }
    const blocked = await upload(1, group.id, jpeg());
    expect(blocked.status).toBe(429);
    expect(await errorOf(blocked)).toBe('rate_limited');
    expect((await call(1, 'DELETE', `/${group.id}/photo`)).status).toBe(429);
    const other = await create(1, 'Other');
    expect((await call(1, 'PUT', `/${other.id}/name`, { name: 'ok' })).status).toBe(200);
  });
});

describe('peek with an invite code', () => {
  it('previews the group and its photo for someone who is not in it', async () => {
    const { crowd, upload, call, repo } = setup();
    const group = await crowd([2]);
    await upload(1, group.id, jpeg());
    const res = await call(9, 'POST', '/peek', { code: group.inviteCode.toLowerCase() });
    expect(res.status).toBe(200);
    expect((await res.json()) as GroupPreview).toEqual({
      name: 'Friends',
      members: 2,
      photoAt: repo.groups.get(group.id)!.photoAt,
    });
    const photo = await call(9, 'POST', '/peek/photo', { code: group.inviteCode });
    expect(photo.status).toBe(200);
    expect(photo.headers.get('Content-Type')).toBe('image/jpeg');
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(jpeg());
    expect(repo.members).toHaveLength(2);
  });

  it('answers 404 not_found when the group has no photo', async () => {
    const { create, call } = setup();
    const group = await create(1);
    const res = await call(9, 'POST', '/peek/photo', { code: group.inviteCode });
    expect(res.status).toBe(404);
    expect(await errorOf(res)).toBe('not_found');
  });

  it('stops accepting the old code once it is renewed', async () => {
    const { create, call } = setup();
    const group = await create(1);
    await call(1, 'POST', `/${group.id}/invite`);
    for (const path of ['/peek', '/peek/photo']) {
      const res = await call(9, 'POST', path, { code: group.inviteCode });
      expect(res.status).toBe(404);
      expect(await errorOf(res)).toBe('group_not_found');
    }
  });

  it('answers 404 for a mistyped code and 400 for a body without code', async () => {
    const { call } = setup();
    expect((await call(9, 'POST', '/peek', { code: 'abc' })).status).toBe(404);
    expect((await call(9, 'POST', '/peek', {})).status).toBe(400);
    expect((await call(9, 'POST', '/peek', { code: 'x'.repeat(3000) })).status).toBe(413);
  });

  it('refuses a kicked device with 403', async () => {
    const { create, join, call } = setup();
    const group = await create(1);
    const joined = (await (await join(2, group.inviteCode)).json()) as GroupDetail;
    await call(1, 'DELETE', `/${group.id}/members/${joined.you}`);
    for (const path of ['/peek', '/peek/photo']) {
      const res = await call(2, 'POST', path, { code: group.inviteCode });
      expect(res.status).toBe(403);
      expect(await errorOf(res)).toBe('kicked');
    }
  });

  it('requires a device key', async () => {
    const { send } = setup();
    const res = await send(1, 'POST', '/peek', { headers: { 'X-Device-Key': 'zz' } });
    expect(res.status).toBe(400);
  });

  it('limits peeks per IP to 30 every 10 minutes, shared by both routes', async () => {
    const { create, call } = setup();
    const group = await create(1);
    const body = { code: group.inviteCode };
    for (let n = 0; n < 30; n++) {
      expect((await call(9, 'POST', '/peek', body)).status).toBe(200);
    }
    expect((await call(9, 'POST', '/peek/photo', body)).status).toBe(429);
  });
});
