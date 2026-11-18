import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiError,
  api,
  apiFor,
  configureApi,
  onUnauthorized,
  playlistCoverUrl,
} from '../src/api/client';

const emptyLibrary = () =>
  new Response(JSON.stringify({ tracks: [] }), { status: 200, headers: { ETag: 'e' } });

function stubFetch(res: () => Response) {
  const fn = vi.fn(async () => res());
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
  configureApi('', null);
});

describe('apiFor', () => {
  it('uses its own baseUrl and token regardless of the global target', async () => {
    configureApi('https://other', 'GLOBAL');
    const fetchMock = stubFetch(emptyLibrary);
    await apiFor({ baseUrl: 'https://x/', token: 'T' }).library();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://x/api/library');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer T');
  });

  it('does not notify onUnauthorized on 401, while api does', async () => {
    const listener = vi.fn();
    const off = onUnauthorized(listener);
    stubFetch(() => new Response('{}', { status: 401 }));
    await expect(apiFor({ baseUrl: 'https://x', token: 'T' }).library()).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(listener).not.toHaveBeenCalled();
    await expect(api.library()).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledTimes(1);
    off();
  });
});

describe('ingestExists', () => {
  it('queries the exists endpoint', async () => {
    const fetchMock = stubFetch(() => new Response(JSON.stringify({ exists: true, id: 'a' })));
    const out = await apiFor({ baseUrl: 'https://x', token: null }).ingestExists('youtube', 'r f');
    expect(out).toEqual({ exists: true, id: 'a' });
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('https://x/api/ingest/exists?source=youtube&ref=r+f');
  });
});

describe('playlist covers', () => {
  it('playlistCoverUrl adds the version and the token without breaking the URL', () => {
    configureApi('https://x/', 'T K');
    expect(playlistCoverUrl('p1', 123)).toBe('https://x/media/playlist-cover/p1?v=123&t=T%20K');
    configureApi('', null);
    expect(playlistCoverUrl('p1', 123)).toBe('/media/playlist-cover/p1?v=123');
  });

  it('setPlaylistCover sends multipart with the cover field', async () => {
    const fetchMock = stubFetch(() => new Response('{}'));
    const jpeg = new Blob(['x'], { type: 'image/jpeg' });
    await apiFor({ baseUrl: 'https://x', token: null }).setPlaylistCover('p1', jpeg);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://x/api/playlists/p1/cover');
    expect(init.method).toBe('PUT');
    expect((init.body as FormData).get('cover')).toBeInstanceOf(Blob);
  });
});

describe('fetchMedia', () => {
  it('returns a Blob', async () => {
    const fetchMock = stubFetch(() => new Response(new Blob(['abc'])));
    const blob = await apiFor({ baseUrl: 'https://x', token: 'T' }).fetchMedia('audio', 'id');
    expect(blob.size).toBe(3);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://x/media/audio/id');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer T');
  });

  it('throws ApiError on 404', async () => {
    stubFetch(() => new Response('{"error":"not_found"}', { status: 404 }));
    await expect(
      apiFor({ baseUrl: 'https://x', token: null }).fetchMedia('cover', 'id'),
    ).rejects.toMatchObject({ status: 404, code: 'not_found' });
  });
});
