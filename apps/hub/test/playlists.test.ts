import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HubHttpError } from '../src/lib/http';
import { playlistRoutes } from '../src/routes/playlists';
import { FakeD1 } from './fakeDb';

const ID = 'PLabcdefghijk';

function call(path: string) {
  const app = new Hono();
  app.route('/hub/v1/playlists', playlistRoutes);
  app.onError((err, c) =>
    err instanceof HubHttpError
      ? c.json({ error: err.code, message: err.message }, err.status)
      : c.json({ error: 'internal_error' }, 500),
  );
  return app.request(`/hub/v1/playlists${path}`, undefined, { DB: new FakeD1() });
}

const video = (videoId: string, title: string) => ({
  playlistVideoRenderer: {
    videoId,
    title: { runs: [{ text: title }] },
    shortBylineText: { runs: [{ text: 'Artist' }] },
    lengthSeconds: '200',
  },
});

afterEach(() => vi.unstubAllGlobals());

describe('GET /playlists/:id', () => {
  it('rejects invalid ids and oversized continuations with 400', async () => {
    expect((await call('/RDabcdefghijk')).status).toBe(400);
    expect((await call('/LL')).status).toBe(400);
    expect((await call('/short')).status).toBe(400);
    expect((await call(`/${ID}?continuation=${'a'.repeat(4097)}`)).status).toBe(400);
  });

  it('answers 502 search_unavailable when YouTube fails', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new Error('network');
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await call(`/${ID}`);
    logged.mockRestore();
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: string }).error).toBe('search_unavailable');
  });

  it('answers 404 playlist_unavailable when the first page is empty', async () => {
    vi.stubGlobal('fetch', async () => Response.json({}));
    const res = await call(`/${ID}`);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('playlist_unavailable');
  });

  it('returns the page with its songs', async () => {
    const json = { contents: [video('dQw4w9WgXcQ', 'One'), video('aaaaaaaaaaa', 'Two')] };
    vi.stubGlobal('fetch', async () => Response.json(json));
    const res = await call(`/${ID}`);
    expect(res.status).toBe(200);
    const page = (await res.json()) as { entries: { id: string }[]; unavailable: number };
    expect(page.entries.map((e) => e.id)).toEqual(['dQw4w9WgXcQ', 'aaaaaaaaaaa']);
    expect(page.unavailable).toBe(0);
  });

  it('sends the continuation token instead of browseId', async () => {
    const spy = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ contents: [video('dQw4w9WgXcQ', 'One')] }),
    );
    vi.stubGlobal('fetch', spy);
    expect((await call(`/${ID}?continuation=TOKEN`)).status).toBe(200);
    const body = JSON.parse(String(spy.mock.calls[0]![1].body)) as Record<string, unknown>;
    expect(body.continuation).toBe('TOKEN');
    expect(body.browseId).toBeUndefined();
  });
});
