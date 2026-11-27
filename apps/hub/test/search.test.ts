import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jamRoutes } from '../src/jam/routes';
import { HubHttpError } from '../src/lib/http';
import { searchRoutes } from '../src/routes/search';
import { FakeD1 } from './fakeDb';

function call(path: string) {
  const app = new Hono();
  app.route('/hub/v1/search', searchRoutes);
  app.onError((err, c) =>
    err instanceof HubHttpError
      ? c.json({ error: err.code, message: err.message }, err.status)
      : c.json({ error: 'internal_error' }, 500),
  );
  return app.request(`/hub/v1/search${path}`, undefined, { DB: new FakeD1() });
}

afterEach(() => vi.unstubAllGlobals());

describe('GET /search', () => {
  it('rejects an invalid query with 400', async () => {
    expect((await call('')).status).toBe(400);
    expect((await call('?q=')).status).toBe(400);
    expect((await call('?q=x&kind=playlists')).status).toBe(400);
    expect((await call(`?q=${'a'.repeat(201)}`)).status).toBe(400);
  });

  it('answers 502 search_unavailable when YouTube is not reachable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('network');
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call('?q=hola');
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe('search_unavailable');
  });

  it('defaults to songs and returns results', async () => {
    const spy = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', spy);
    const res = await call('?q=hola&kind=videos&lang=en');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [], continuation: null });
    expect(spy).toHaveBeenCalledOnce();
  });

  it('forwards a valid continuation and returns the next token', async () => {
    const spy = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({
        continuationItemRenderer: {
          continuationEndpoint: { continuationCommand: { token: 'NEXT' } },
        },
      }),
    );
    vi.stubGlobal('fetch', spy);
    const res = await call(`?q=hola&continuation=${encodeURIComponent('abc%3D')}`);
    expect(await res.json()).toEqual({ results: [], continuation: 'NEXT' });
    expect(JSON.parse(String(spy.mock.calls[0]![1].body))).toMatchObject({
      continuation: 'abc%3D',
    });
  });

  it('rejects a strange or too long continuation without calling YouTube', async () => {
    const spy = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', spy);
    for (const bad of ['', 'a%20b', '%3Cscript%3E', 'a'.repeat(4097)]) {
      expect((await call(`?q=hola&continuation=${bad}`)).status).toBe(400);
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('logs the detail when YouTube answers with an error status', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 429 }));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call('?q=hola');
    expect(logged).toHaveBeenCalledWith('YouTube search failed', 429);
    logged.mockRestore();
    expect(res.status).toBe(502);
  });
});

describe('GET /jams/:code/search', () => {
  it('still answers only the results, without the continuation', async () => {
    vi.stubGlobal('fetch', async () => Response.json({}));
    const JAM = { idFromName: (code: string) => code, get: () => ({ info: async () => ({}) }) };
    const res = await jamRoutes.request('/ABC234/search?q=hi', undefined, {
      DB: new FakeD1(),
      JAM,
    });
    expect(await res.json()).toEqual({ results: [] });
  });
});
