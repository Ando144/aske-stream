import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { PAIRING_CODE_ALPHABET } from '@aske/shared/pairing';
import { cleanup } from '../src/cleanup';
import { HubHttpError } from '../src/lib/http';
import { parcelRoutes } from '../src/routes/parcels';
import { FakeD1 } from './fakeDb';

const song = { videoId: 'dQw4w9WgXcQ', title: 't', artist: 'a' };
const other = { videoId: 'aaaaaaaaaaa', title: 'u', artist: 'b' };

const manySongs = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ ...song, videoId: `v${String(i).padStart(10, '0')}` }));

interface Created {
  code: string;
  senderKey: string;
  expiresAt: number;
  count: number;
}

function setup() {
  const db = new FakeD1();
  const app = new Hono();
  app.route('/hub/v1/parcels', parcelRoutes);
  app.onError((err, c) =>
    err instanceof HubHttpError
      ? c.json({ error: err.code, message: err.message }, err.status)
      : c.json({ error: 'internal_error' }, 500),
  );
  const call = (path: string, init?: RequestInit) =>
    app.request(`/hub/v1/parcels${path}`, init, { DB: db });
  const create = (body: unknown) =>
    call('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  const make = async (songs: unknown[] = [song]) =>
    (await (await create({ songs })).json()) as Created;
  const withKey = (method: string, key: string) => ({ method, headers: { 'X-Delete-Key': key } });
  return { db, call, create, make, withKey };
}

describe('create parcel', () => {
  it('returns code, key, expiry and the deduplicated count', async () => {
    const { create, db } = setup();
    const before = Date.now();
    const res = await create({ songs: [song, other, song] });
    expect(res.status).toBe(201);
    const created = (await res.json()) as Created;
    expect(created.code).toHaveLength(6);
    for (const char of created.code) expect(PAIRING_CODE_ALPHABET).toContain(char);
    expect(created.senderKey).toMatch(/^[0-9a-f]{32}$/);
    expect(created.count).toBe(2);
    expect(created.expiresAt).toBeGreaterThanOrEqual(before + 24 * 3600 * 1000);
    const row = db.parcels.get(created.code)!;
    expect(row.sender_key_hash).not.toBe(created.senderKey);
    expect(Object.keys(row).sort()).toEqual(
      [
        'code',
        'created_at',
        'expires_at',
        'name',
        'sender_key_hash',
        'songs_json',
        'unavailable',
      ].sort(),
    );
  });

  it('rejects empty, invalid and oversized parcels', async () => {
    const { create } = setup();
    expect((await create({ songs: [] })).status).toBe(400);
    expect((await create({ songs: [{ ...song, videoId: 'bad' }] })).status).toBe(400);
    expect((await create({ songs: manySongs(1001) })).status).toBe(413);
  });

  it('accepts 1000 songs', async () => {
    const { create } = setup();
    const res = await create({ songs: manySongs(1000) });
    expect(res.status).toBe(201);
    expect(((await res.json()) as Created).count).toBe(1000);
  });

  it('stores a clean name and the unavailable count, and claim returns them', async () => {
    const { create, call, db } = setup();
    const res = await create({ songs: [song], name: '  My\u0000 list  ', unavailable: 3 });
    const { code } = (await res.json()) as Created;
    expect(db.parcels.get(code)).toMatchObject({ name: 'My list', unavailable: 3 });
    const claimed = await call(`/${code}/claim`, { method: 'POST' });
    expect(await claimed.json()).toMatchObject({ name: 'My list', unavailable: 3 });
  });

  it('defaults to no name and no unavailable songs', async () => {
    const { make, call } = setup();
    const { code } = await make();
    const claimed = await call(`/${code}/claim`, { method: 'POST' });
    expect(await claimed.json()).toMatchObject({ name: '', unavailable: 0 });
  });

  it('rejects a bad unavailable count', async () => {
    const { create } = setup();
    expect((await create({ songs: [song], unavailable: -1 })).status).toBe(400);
    expect((await create({ songs: [song], unavailable: 100001 })).status).toBe(400);
  });
});

describe('claim parcel', () => {
  it('returns the songs once and then answers 404', async () => {
    const { call, make } = setup();
    const { code } = await make([song, other]);
    const first = await call(`/${code}/claim`, { method: 'POST' });
    expect(first.status).toBe(200);
    expect(((await first.json()) as { songs: unknown[] }).songs).toEqual([song, other]);
    expect((await call(`/${code}/claim`, { method: 'POST' })).status).toBe(404);
  });

  it('answers 410 for an expired parcel and removes it', async () => {
    const { call, make, db } = setup();
    const { code } = await make();
    db.parcels.get(code)!.expires_at = Date.now() - 1;
    expect((await call(`/${code}/claim`, { method: 'POST' })).status).toBe(410);
    expect(db.parcels.has(code)).toBe(false);
  });

  it('answers 404 for a badly formatted code', async () => {
    const { call } = setup();
    expect((await call('/nope/claim', { method: 'POST' })).status).toBe(404);
  });

  it('rate limits after 20 claims in 10 minutes', async () => {
    const { call } = setup();
    for (let i = 0; i < 20; i++) {
      expect((await call('/ABCDEF/claim', { method: 'POST' })).status).toBe(404);
    }
    const res = await call('/ABCDEF/claim', { method: 'POST' });
    expect(res.status).toBe(429);
    expect(((await res.json()) as { error: string }).error).toBe('rate_limited');
  });

  it('shares the claim limit with delete lookups', async () => {
    const { call } = setup();
    for (let i = 0; i < 20; i++) await call('/ABCDEF', { method: 'DELETE' });
    expect((await call('/ABCDEF', { method: 'DELETE' })).status).toBe(429);
    expect((await call('/ABCDEF/claim', { method: 'POST' })).status).toBe(429);
  });

  it('lets the sender poll the status far beyond 20 times without a 429', async () => {
    const { call } = setup();
    for (let i = 0; i < 30; i++) {
      expect((await call('/ABCDEF', { method: 'GET' })).status).not.toBe(429);
    }
    // Polling must not use up the claim budget.
    expect((await call('/ABCDEF/claim', { method: 'POST' })).status).toBe(404);
  });
});

describe('parcel status and cancel', () => {
  it('shows the status only with the right key', async () => {
    const { call, make, withKey } = setup();
    const { code, senderKey } = await make([song, other]);
    const ok = await call(`/${code}`, withKey('GET', senderKey));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ code, count: 2 });
    expect((await call(`/${code}`, withKey('GET', 'bad'))).status).toBe(404);
  });

  it('answers 404 once claimed and 410 once expired', async () => {
    const { call, make, withKey, db } = setup();
    const claimed = await make();
    await call(`/${claimed.code}/claim`, { method: 'POST' });
    expect((await call(`/${claimed.code}`, withKey('GET', claimed.senderKey))).status).toBe(404);

    const old = await make();
    db.parcels.get(old.code)!.expires_at = Date.now() - 1;
    expect((await call(`/${old.code}`, withKey('GET', old.senderKey))).status).toBe(410);
  });

  it('cancels only with the right key', async () => {
    const { call, make, withKey, db } = setup();
    const { code, senderKey } = await make();
    expect((await call(`/${code}`, withKey('DELETE', 'bad'))).status).toBe(403);
    expect(db.parcels.has(code)).toBe(true);
    expect((await call(`/${code}`, withKey('DELETE', senderKey))).status).toBe(204);
    expect((await call(`/${code}/claim`, { method: 'POST' })).status).toBe(404);
  });
});

describe('cleanup', () => {
  it('deletes expired parcels', async () => {
    const statements: { sql: string; args: unknown[] }[] = [];
    const DB = {
      prepare: (sql: string) => ({ bind: (...args: unknown[]) => ({ sql, args }) }),
      batch: async (list: { sql: string; args: unknown[] }[]) => {
        statements.push(...list);
        return [];
      },
    } as unknown as D1Database;
    await cleanup({ DB }, 1234);
    expect(statements).toContainEqual({
      sql: 'DELETE FROM parcels WHERE expires_at < ?',
      args: [1234],
    });
  });
});
