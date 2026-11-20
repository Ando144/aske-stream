import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HUB_LIMITS } from '@aske/shared/hub';
import { PAIRING_CODE_ALPHABET } from '@aske/shared/pairing';
import { FakeD1 } from './fakeDb';
import { FakeCtx } from './fakeRoom';

vi.mock('cloudflare:workers', () => ({
  DurableObject: class {
    constructor(
      public ctx: unknown,
      public env: unknown,
    ) {}
  },
}));

const { JamRoom } = await import('../src/jam/room');
const { sha256Hex } = await import('../src/lib/crypto');
const { jamRoutes } = await import('../src/jam/routes');
const { HubHttpError } = await import('../src/lib/http');

const NOW = 1_700_000_000_000;

/** Namespace whose stubs are real JamRoom instances backed by an in-memory ctx. */
function fakeNamespace() {
  const rooms = new Map<string, InstanceType<typeof JamRoom>>();
  const ctxs = new Map<string, FakeCtx>();
  return {
    rooms,
    ctxs,
    idFromName: (name: string) => name,
    get: (id: string) => {
      if (!rooms.has(id)) {
        const ctx = new FakeCtx();
        ctxs.set(id, ctx);
        rooms.set(id, new JamRoom(ctx as never, {} as never));
      }
      return rooms.get(id)!;
    },
  };
}

function setup() {
  const db = new FakeD1();
  const jam = fakeNamespace();
  const app = new Hono();
  app.route('/hub/v1/jams', jamRoutes);
  app.onError((err, c) =>
    err instanceof HubHttpError
      ? c.json({ error: err.code, message: err.message }, err.status)
      : c.json({ error: 'internal_error' }, 500),
  );
  const call = (path: string, init?: RequestInit) =>
    app.request(`/hub/v1/jams${path}`, init, { DB: db, JAM: jam });
  const create = (body: unknown, headers: Record<string, string> = {}) =>
    call('', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  return { db, jam, call, create };
}

type Created = { code: string; hostKey: string; expiresAt: number };

describe('jam routes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('creates a Jam with a valid code, a hostKey and a 12 h expiry', async () => {
    const { create } = setup();
    const res = await create({ hostName: 'Ann' });
    expect(res.status).toBe(201);
    const jam = (await res.json()) as Created;
    expect(jam.code).toHaveLength(HUB_LIMITS.jamCodeLength);
    for (const ch of jam.code) expect(PAIRING_CODE_ALPHABET).toContain(ch);
    expect(jam.hostKey).toMatch(/^[0-9a-f]{32}$/);
    expect(jam.expiresAt).toBe(NOW + HUB_LIMITS.jamTtlMs);
  });

  it('stores only the hash of the hostKey, never the key', async () => {
    const { create, jam } = setup();
    const created = (await (await create({ hostName: 'Ann' })).json()) as Created;
    const stored = jam.ctxs.get(created.code)!.store.get('jam') as { hostKeyHash: string };
    expect(stored.hostKeyHash).toBe(await sha256Hex(created.hostKey));
    expect(JSON.stringify(stored)).not.toContain(created.hostKey);
  });

  it('normalizes the host name', async () => {
    const { create, call } = setup();
    const created = (await (await create({ hostName: '  Ann   Lee ' })).json()) as Created;
    const info = (await (await call(`/${created.code}`)).json()) as { hostName: string };
    expect(info.hostName).toBe('Ann Lee');
  });

  it('rejects missing, empty, overlong or non-string host names and bad JSON with 400', async () => {
    const { create } = setup();
    for (const body of [
      {},
      { hostName: '   ' },
      { hostName: 'x'.repeat(HUB_LIMITS.nicknameMax + 1) },
      { hostName: 'x'.repeat(201) },
      { hostName: 42 },
      '{broken',
    ]) {
      const res = await create(body);
      expect(res.status).toBe(400);
    }
  });

  it('retries when a code is taken and gives up with 500 after 5 collisions', async () => {
    const { create, jam } = setup();
    const taken = vi.spyOn(JamRoom.prototype, 'init');
    taken.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect((await create({ hostName: 'Ann' })).status).toBe(201);
    expect(taken).toHaveBeenCalledTimes(2);
    taken.mockReset().mockResolvedValue(false);
    const res = await create({ hostName: 'Ann' });
    expect(res.status).toBe(500);
    expect(taken).toHaveBeenCalledTimes(5);
    expect(jam.rooms.size).toBeGreaterThan(0);
    taken.mockRestore();
  });

  it('limits Jam creation to 10 per hour per IP with 429', async () => {
    const { create } = setup();
    const ip = { 'CF-Connecting-IP': '1.2.3.4' };
    for (let i = 0; i < 10; i++) expect((await create({ hostName: 'A' }, ip)).status).toBe(201);
    expect((await create({ hostName: 'A' }, ip)).status).toBe(429);
    expect((await create({ hostName: 'A' }, { 'CF-Connecting-IP': '5.6.7.8' })).status).toBe(201);
  });

  it('GET /:code returns the info, accepting lowercase and dashes', async () => {
    const { create, call } = setup();
    const created = (await (await create({ hostName: 'Ann' })).json()) as Created;
    const spaced = `${created.code.slice(0, 3)}-${created.code.slice(3)}`.toLowerCase();
    const res = await call(`/${spaced}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      code: created.code,
      hostName: 'Ann',
      expiresAt: created.expiresAt,
      members: 0,
    });
  });

  it('GET /:code answers 404 for malformed codes and for codes with no Jam', async () => {
    const { call } = setup();
    for (const code of ['ABC', 'ABCDEFG', 'ABC10O', 'ABC234']) {
      expect((await call(`/${code}`)).status).toBe(404);
    }
  });

  it('GET /:code answers 404 once the Jam has expired', async () => {
    const { create, call } = setup();
    const created = (await (await create({ hostName: 'Ann' })).json()) as Created;
    vi.setSystemTime(created.expiresAt);
    expect((await call(`/${created.code}`)).status).toBe(404);
  });

  it('GET /:code/ws needs the Upgrade header (400) and an existing Jam (404)', async () => {
    const { create, call } = setup();
    const created = (await (await create({ hostName: 'Ann' })).json()) as Created;
    expect((await call(`/${created.code}/ws`)).status).toBe(400);
    const res = await call('/ABC234/ws', { headers: { Upgrade: 'websocket' } });
    expect(res.status).toBe(404);
  });

  describe('search', () => {
    it('rejects an empty or overlong query and an unknown language with 400', async () => {
      const { create, call } = setup();
      const { code } = (await (await create({ hostName: 'Ann' })).json()) as Created;
      for (const qs of ['', '?q=', '?q=%20%20', `?q=${'x'.repeat(201)}`, '?q=hi&lang=fr']) {
        expect((await call(`/${code}/search${qs}`)).status).toBe(400);
      }
    });

    it('answers 404 for a Jam that does not exist, before touching YouTube', async () => {
      const { call } = setup();
      const spy = vi.fn();
      vi.stubGlobal('fetch', spy);
      expect((await call('/ABC234/search?q=hi')).status).toBe(404);
      expect(spy).not.toHaveBeenCalled();
    });

    it('answers 502 search_unavailable when YouTube fails or is unreachable', async () => {
      const { create, call } = setup();
      const { code } = (await (await create({ hostName: 'Ann' })).json()) as Created;
      vi.stubGlobal('fetch', async () => new Response('x', { status: 500 }));
      const failed = await call(`/${code}/search?q=hi`);
      expect(failed.status).toBe(502);
      expect(((await failed.json()) as { error: string }).error).toBe('search_unavailable');
      vi.stubGlobal('fetch', async () => {
        throw new Error('offline');
      });
      expect((await call(`/${code}/search?q=hi`)).status).toBe(502);
    });

    it('returns parsed results on success', async () => {
      const { create, call } = setup();
      const { code } = (await (await create({ hostName: 'Ann' })).json()) as Created;
      vi.stubGlobal('fetch', async () => Response.json({}));
      const res = await call(`/${code}/search?q=hi&lang=en`);
      expect(res.status).toBe(200);
      expect(((await res.json()) as { results: unknown[] }).results).toEqual(expect.any(Array));
    });

    it('limits search to 60 requests per 10 minutes per IP with 429', async () => {
      const { create, call } = setup();
      const { code } = (await (await create({ hostName: 'Ann' })).json()) as Created;
      vi.stubGlobal('fetch', async () => Response.json({}));
      const ip = { 'CF-Connecting-IP': '9.9.9.9' };
      for (let i = 0; i < 60; i++) {
        expect((await call(`/${code}/search?q=hi`, { headers: ip })).status).toBe(200);
      }
      expect((await call(`/${code}/search?q=hi`, { headers: ip })).status).toBe(429);
    });
  });
});
