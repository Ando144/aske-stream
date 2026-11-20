import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCfApi } from '../src/cloudflare/api';
import { bytesToBase64, loadBundle, type WorkerBundle } from '../src/cloudflare/bundle';
import { runSetup, runUpdate, SetupError, waitUntilLive } from '../src/cloudflare/setup';
import { FakeCloudflare, fail, ok } from './cloudflare/fakeCloudflare';

const manifest = {
  version: '1.2.3',
  compatibilityDate: '2025-01-01',
  mainModule: 'index.js' as const,
  migrations: [{ name: '0001_a.sql', sql: 'CREATE TABLE a(x)' }],
  assets: { '/index.html': { hash: 'h1', size: 3 } },
};
const bundle: WorkerBundle = { manifest, code: 'export default {}', readAsset: async () => 'QUJD' };

function liveFetch(version: string): typeof fetch {
  return (async () => new Response(JSON.stringify({ ok: true, version }))) as typeof fetch;
}

function fakeAccount(opts: { subdomain: string | null; script?: boolean }): FakeCloudflare {
  return new FakeCloudflare()
    .on('GET /accounts/a1/workers/subdomain', () =>
      opts.subdomain ? ok({ subdomain: opts.subdomain }) : fail(404, 10007),
    )
    .on('PUT /accounts/a1/workers/subdomain', (r) =>
      ok({ subdomain: (r.json as { subdomain: string }).subdomain }),
    )
    .on('GET /accounts/a1/d1/database', ok([{ uuid: 'db1', name: 'aske-stream' }]))
    .on('GET /accounts/a1/r2/buckets/aske-stream-media', ok({}))
    .on('POST /accounts/a1/d1/database/db1/query', ok([{ results: [] }]))
    .on('POST /accounts/a1/workers/scripts/aske-stream/assets-upload-session', ok({ jwt: 'j' }));
}

const live = { fetchFn: liveFetch('1.2.3'), tries: 1, delayMs: 0 };

describe('runSetup', () => {
  it('runs the steps in order and returns the Worker URL and a fresh key', async () => {
    const fake = fakeAccount({ subdomain: null });
    const steps: string[] = [];
    const r = await runSetup({
      api: createCfApi(fake.transport, 'tok'),
      bundle,
      accountId: 'a1',
      subdomain: 'aske-abcd',
      live,
      onStep: (s) => steps.push(s),
    });
    expect(r.baseUrl).toBe('https://aske-stream.aske-abcd.workers.dev');
    expect(r.accessKey).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(steps).toEqual([
      'subdomain',
      'storage',
      'database',
      'migrations',
      'files',
      'worker',
      'publish',
      'waiting',
    ]);
    const lines = fake.lines();
    const idx = (p: string) => lines.findIndex((l) => l.startsWith(p));
    expect(idx('PUT /accounts/a1/workers/subdomain')).toBeLessThan(idx('GET /accounts/a1/r2'));
    expect(idx('POST /accounts/a1/d1/database/db1/query')).toBeLessThan(
      idx('PUT /accounts/a1/workers/scripts/aske-stream'),
    );
    expect(idx('PUT /accounts/a1/workers/scripts/aske-stream')).toBeLessThan(
      idx('POST /accounts/a1/workers/scripts/aske-stream/subdomain'),
    );
  });

  it('reuses the existing subdomain instead of creating one', async () => {
    const fake = fakeAccount({ subdomain: 'mine' });
    const r = await runSetup({
      api: createCfApi(fake.transport, 'tok'),
      bundle,
      accountId: 'a1',
      subdomain: 'ignored',
      live,
      onStep: () => undefined,
    });
    expect(r.baseUrl).toBe('https://aske-stream.mine.workers.dev');
    expect(fake.lines()).not.toContain('PUT /accounts/a1/workers/subdomain');
  });

  it('fails with not_live_yet and keeps what is needed to resume', async () => {
    const fake = fakeAccount({ subdomain: 'mine' });
    const err = await runSetup({
      api: createCfApi(fake.transport, 'tok'),
      bundle,
      accountId: 'a1',
      subdomain: 'x',
      live: { fetchFn: liveFetch('0.0.1'), tries: 2, delayMs: 0 },
      onStep: () => undefined,
    }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(SetupError);
    expect((err as SetupError).code).toBe('not_live_yet');
    expect((err as SetupError).resume?.baseUrl).toBe('https://aske-stream.mine.workers.dev');
    expect((err as SetupError).resume?.accessKey).toBeTruthy();
  });
});

describe('runUpdate', () => {
  const current = 'https://aske-stream.mine.workers.dev';

  it('migrates before uploading the script and sends no access key', async () => {
    const fake = fakeAccount({ subdomain: 'mine' });
    const steps: string[] = [];
    const r = await runUpdate({
      api: createCfApi(fake.transport, 'tok'),
      bundle,
      accountId: 'a1',
      currentBaseUrl: current,
      live,
      onStep: (s) => steps.push(s),
    });
    expect(r.baseUrl).toBe(current);
    expect(steps).toEqual(['account', 'database', 'migrations', 'files', 'worker', 'waiting']);
    const lines = fake.lines();
    expect(lines.findIndex((l) => l.includes('/query'))).toBeLessThan(
      lines.findIndex((l) => l.startsWith('PUT /accounts/a1/workers/scripts')),
    );
    const put = fake.requests.find((q) => q.method === 'PUT' && q.path.includes('/scripts/'));
    expect(put?.form?.[0]?.value).not.toContain('secret_text","name":"ACCESS_KEY');
  });

  it('refuses an account that does not host the connected Worker', async () => {
    const fake = fakeAccount({ subdomain: 'other' });
    await expect(
      runUpdate({
        api: createCfApi(fake.transport, 'tok'),
        bundle,
        accountId: 'a1',
        currentBaseUrl: current,
        live,
        onStep: () => undefined,
      }),
    ).rejects.toMatchObject({ code: 'wrong_account' });
    expect(fake.lines().some((l) => l.startsWith('PUT'))).toBe(false);
  });
});

describe('waitUntilLive', () => {
  it('retries until the version matches', async () => {
    const fetchFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: '0.1.0' })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ version: '1.2.3' })));
    await waitUntilLive('https://w', '1.2.3', {
      fetchFn: fetchFn as unknown as typeof fetch,
      tries: 5,
      delayMs: 0,
    });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});

describe('bundle', () => {
  it('encodes large buffers without overflowing', () => {
    const big = new Uint8Array(500_000).fill(65);
    expect(atob(bytesToBase64(big)).length).toBe(500_000);
  });

  it('loads manifest, code and assets; reports bundle_missing', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.endsWith('manifest.json')) return new Response(JSON.stringify(manifest));
      if (url.endsWith('index.js')) return new Response('code');
      if (url.endsWith('/site/index.html')) return new Response(new Uint8Array([65, 66, 67]));
      return new Response('', { status: 404 });
    });
    const b = await loadBundle(fetchFn as unknown as typeof fetch);
    expect(b.code).toBe('code');
    expect(await b.readAsset('/index.html')).toBe('QUJD');
    await expect(
      loadBundle((async () => new Response('', { status: 404 })) as typeof fetch),
    ).rejects.toThrow('bundle_missing');
  });
});

// ---- store ----

const TOKEN = 'super-secret-token-123';
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
});

describe('cloudflareSetup store', () => {
  async function loadStore(fake: FakeCloudflare, health = '1.2.3') {
    vi.resetModules();
    vi.doMock('../src/native/cloudflareApi', () => ({ nativeCfTransport: fake.transport }));
    vi.doMock('../src/cloudflare/bundle', () => ({ loadBundle: async () => bundle }));
    vi.doMock('../src/offline/db', () => ({ getDb: vi.fn(), kvGet: vi.fn() }));
    vi.doMock('../src/storage/drive/auth', () => ({}));
    vi.doMock('../src/storage/drive/home', () => ({ driveHome: {} }));
    vi.doMock('../src/api/client', async (orig) => ({
      ...(await orig<typeof import('../src/api/client')>()),
      configureApi: vi.fn(),
      api: { pair: vi.fn(async () => ({ paired: true, token: 'dev' })), health: vi.fn() },
    }));
    vi.stubGlobal('fetch', liveFetch(health));
    const { useCloudflareSetup } = await import('../src/stores/cloudflareSetup');
    const { useSetup } = await import('../src/stores/setup');
    return { useCloudflareSetup, useSetup };
  }

  function expectNoSecret(state: unknown) {
    expect(JSON.stringify(state)).not.toContain(TOKEN);
    expect(JSON.stringify([...store.entries()])).not.toContain(TOKEN);
  }

  function withAccount(): FakeCloudflare {
    return fakeAccount({ subdomain: 'mine' })
      .on('GET /user/tokens/verify', ok({ status: 'active' }))
      .on('GET /accounts?', ok([]))
      .on('GET /accounts/a1/workers/scripts/aske-stream/settings', fail(404, 10007));
  }

  function fakeWithAccounts(accounts: { id: string; name: string }[]): FakeCloudflare {
    return withAccount().on('GET /accounts', (r) =>
      r.path === '/accounts' ? ok(accounts) : ok(null),
    );
  }

  it('sets up end to end, connects with the new key and keeps no token', async () => {
    const { useCloudflareSetup, useSetup } = await loadStore(
      fakeWithAccounts([{ id: 'a1', name: 'Me' }]),
    );
    const s = useCloudflareSetup.getState();
    s.start('setup');
    s.next();
    s.next();
    s.next();
    expect(useCloudflareSetup.getState().phase).toBe('token');
    await useCloudflareSetup.getState().submitToken(TOKEN);
    expect(useCloudflareSetup.getState().phase).toBe('done');
    expect(useSetup.getState().config?.cloudflare?.baseUrl).toBe(
      'https://aske-stream.mine.workers.dev',
    );
    expectNoSecret(useCloudflareSetup.getState());
    expectNoSecret(useSetup.getState());
  });

  it('asks for the account and the subdomain when needed', async () => {
    const fake = fakeWithAccounts([
      { id: 'a1', name: 'A' },
      { id: 'a2', name: 'B' },
    ]).on('GET /accounts/a1/workers/subdomain', fail(404, 10007));
    const { useCloudflareSetup } = await loadStore(fake);
    useCloudflareSetup.getState().start('setup');
    await useCloudflareSetup.getState().submitToken(TOKEN);
    expect(useCloudflareSetup.getState().phase).toBe('chooseAccount');
    await useCloudflareSetup.getState().pickAccount('a1');
    expect(useCloudflareSetup.getState().phase).toBe('chooseSubdomain');
    expect(useCloudflareSetup.getState().suggestedSubdomain).toMatch(/^aske-[a-z0-9]{4}$/);
    await useCloudflareSetup.getState().chooseSubdomain('Aske-Test');
    expect(useCloudflareSetup.getState().phase).toBe('done');
    expectNoSecret(useCloudflareSetup.getState());
  });

  it('asks to confirm when the script already exists', async () => {
    const fake = fakeWithAccounts([{ id: 'a1', name: 'A' }]).on(
      'GET /accounts/a1/workers/scripts/aske-stream/settings',
      ok({}),
    );
    const { useCloudflareSetup } = await loadStore(fake);
    useCloudflareSetup.getState().start('setup');
    await useCloudflareSetup.getState().submitToken(TOKEN);
    expect(useCloudflareSetup.getState().phase).toBe('confirmExisting');
    await useCloudflareSetup.getState().confirmExisting();
    expect(useCloudflareSetup.getState().phase).toBe('done');
  });

  it('shows a clean error for a bad token and forgets it', async () => {
    const fake = fakeWithAccounts([]).on('GET /user/tokens/verify', fail(401, 10000));
    const { useCloudflareSetup } = await loadStore(fake);
    useCloudflareSetup.getState().start('setup');
    await useCloudflareSetup.getState().submitToken(TOKEN);
    expect(useCloudflareSetup.getState().phase).toBe('error');
    expect(useCloudflareSetup.getState().error).toBe('invalid_token');
    expectNoSecret(useCloudflareSetup.getState());
    await useCloudflareSetup.getState().retry();
    expect(useCloudflareSetup.getState().phase).toBe('token');
  });

  it('after subdomain_taken, retry asks for a new name without the token', async () => {
    const fake = fakeWithAccounts([{ id: 'a1', name: 'A' }])
      .on('GET /accounts/a1/workers/subdomain', fail(404, 10007))
      .on('PUT /accounts/a1/workers/subdomain', fail(409, 10036));
    const { useCloudflareSetup } = await loadStore(fake);
    useCloudflareSetup.getState().start('setup');
    await useCloudflareSetup.getState().submitToken(TOKEN);
    expect(useCloudflareSetup.getState().phase).toBe('chooseSubdomain');
    await useCloudflareSetup.getState().chooseSubdomain('taken');
    expect(useCloudflareSetup.getState().error).toBe('subdomain_taken');
    expectNoSecret(useCloudflareSetup.getState());

    fake.on('PUT /accounts/a1/workers/subdomain', (r) =>
      ok({ subdomain: (r.json as { subdomain: string }).subdomain }),
    );
    await useCloudflareSetup.getState().retry();
    const s = useCloudflareSetup.getState();
    expect(s.phase).toBe('chooseSubdomain');
    expect(s.error).toBeNull();
    expect(s.suggestedSubdomain).toMatch(/^aske-[a-z0-9]{4}$/);
    await s.chooseSubdomain('otro');
    expect(useCloudflareSetup.getState().phase).toBe('done');
    expectNoSecret(useCloudflareSetup.getState());
  });

  it('RUNNING_STEPS match the steps the runners emit', async () => {
    const { RUNNING_STEPS } = await import('../src/components/cloudflareSetup/RunningStep');
    const setupSteps: string[] = [];
    await runSetup({
      api: createCfApi(fakeAccount({ subdomain: null }).transport, 'tok'),
      bundle,
      accountId: 'a1',
      subdomain: 'aske-abcd',
      live,
      onStep: (s) => setupSteps.push(s),
    });
    const updateSteps: string[] = [];
    await runUpdate({
      api: createCfApi(fakeAccount({ subdomain: 'mine' }).transport, 'tok'),
      bundle,
      accountId: 'a1',
      currentBaseUrl: 'https://aske-stream.mine.workers.dev',
      live,
      onStep: (s) => updateSteps.push(s),
    });
    expect(RUNNING_STEPS.setup).toEqual(['account', ...setupSteps]);
    expect(RUNNING_STEPS.update).toEqual(updateSteps);
  });

  it('cancel clears everything', async () => {
    const { useCloudflareSetup } = await loadStore(fakeWithAccounts([]));
    useCloudflareSetup.getState().start('update');
    useCloudflareSetup.getState().cancel();
    expect(useCloudflareSetup.getState().phase).toBe('intro');
    expectNoSecret(useCloudflareSetup.getState());
  });

  it('retry after not_live_yet only waits and pairs, without the token', async () => {
    const fake = fakeWithAccounts([{ id: 'a1', name: 'A' }]);
    const { useCloudflareSetup, useSetup } = await loadStore(fake, '0.0.1');
    vi.useFakeTimers();
    useCloudflareSetup.getState().start('setup');
    const p = useCloudflareSetup.getState().submitToken(TOKEN);
    await vi.runAllTimersAsync();
    await p;
    vi.useRealTimers();
    expect(useCloudflareSetup.getState().error).toBe('not_live_yet');
    const before = fake.requests.length;
    vi.stubGlobal('fetch', liveFetch('1.2.3'));
    await useCloudflareSetup.getState().retry();
    expect(useCloudflareSetup.getState().phase).toBe('done');
    expect(fake.requests.length).toBe(before);
    expect(useSetup.getState().config?.home).toBe('cloudflare');
    expectNoSecret(useCloudflareSetup.getState());
  });
});
