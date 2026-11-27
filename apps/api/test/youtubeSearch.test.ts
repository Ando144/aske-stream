import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../src/lib/http';
import { youtubeRoutes } from '../src/routes/youtube';

function call(query: string) {
  const app = new Hono();
  app.route('/api/youtube', youtubeRoutes);
  app.onError((err, c) =>
    err instanceof HttpError
      ? c.json({ error: err.code, message: err.message }, err.status)
      : c.json({ error: 'internal_error' }, 500),
  );
  return app.request(`/api/youtube/search${query}`);
}

const nextPage = {
  contents: [
    { videoRenderer: { videoId: 'vid00000001', title: { simpleText: 'Song' } } },
    { continuationItemRenderer: { continuationEndpoint: { continuationCommand: { token: 'N' } } } },
  ],
};

async function expectUnavailable(youtube: () => Promise<Response>) {
  vi.stubGlobal('fetch', youtube);
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  const res = await call('?q=hola');
  expect(logged).toHaveBeenCalled();
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({
    error: 'search_unavailable',
    message: 'YouTube search is not reachable',
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/youtube/search', () => {
  it('returns the results and the continuation token', async () => {
    vi.stubGlobal('fetch', async () => Response.json(nextPage));
    const res = await call('?q=hola&kind=videos');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ results: [{ id: 'vid00000001' }], continuation: 'N' });
  });

  it('answers a null continuation when there are no more pages', async () => {
    vi.stubGlobal('fetch', async () => Response.json({}));
    expect(await (await call('?q=hola')).json()).toEqual({ results: [], continuation: null });
  });

  it('forwards a valid continuation to YouTube', async () => {
    const spy = vi.fn(async (_url: string, _init: RequestInit) => Response.json({}));
    vi.stubGlobal('fetch', spy);
    await call(`?q=hola&continuation=${encodeURIComponent('abc%3D')}`);
    const body = JSON.parse(String(spy.mock.calls[0]![1].body));
    expect(body.continuation).toBe('abc%3D');
    expect(body).not.toHaveProperty('query');
  });

  it('rejects a strange or too long continuation with 400', async () => {
    const spy = vi.fn(async () => Response.json({}));
    vi.stubGlobal('fetch', spy);
    for (const bad of ['', 'a%20b', '%3Cscript%3E', 'a'.repeat(4097)]) {
      const res = await call(`?q=hola&continuation=${bad}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'validation_error' });
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it('answers 502 and logs when YouTube is not reachable', async () => {
    await expectUnavailable(async () => {
      throw new Error('network');
    });
  });

  it('answers 502 and logs when YouTube answers with an error status', async () => {
    await expectUnavailable(async () => new Response('nope', { status: 429 }));
  });

  it('answers 502 and logs when YouTube does not send JSON', async () => {
    await expectUnavailable(async () => new Response('<html>'));
  });
});
