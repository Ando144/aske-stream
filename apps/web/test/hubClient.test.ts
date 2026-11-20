import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadClient(hubUrl: string) {
  vi.resetModules();
  vi.stubEnv('VITE_HUB_URL', hubUrl);
  return import('../src/hub/client');
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('hub client', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('returns the parsed body on success', async () => {
    const client = await loadClient('https://hub.example/');
    fetchMock.mockResolvedValue(json(201, { id: 'x', deleteKey: 'k', expiresAt: 1 }));
    const created = await client.createSharedList('Mix', [
      { videoId: 'dQw4w9WgXcQ', title: 'T', artist: 'A' },
    ]);
    expect(created.id).toBe('x');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://hub.example/hub/v1/lists');
    expect(init.method).toBe('POST');
  });

  it('turns an error body into a HubError with its code and status', async () => {
    const client = await loadClient('https://hub.example');
    fetchMock.mockResolvedValue(json(410, { error: 'expired', message: 'gone' }));
    await expect(client.getSharedList('23456789AB')).rejects.toMatchObject({
      name: 'HubError',
      code: 'expired',
      status: 410,
    });
  });

  it('reports network failures as code network and status 0', async () => {
    const client = await loadClient('https://hub.example');
    fetchMock.mockRejectedValue(new TypeError('offline'));
    await expect(client.getJam('ABCDEF')).rejects.toMatchObject({ code: 'network', status: 0 });
  });

  it('fails with unavailable, without calling fetch, when there is no hub', async () => {
    const client = await loadClient('');
    expect(client.hubAvailable()).toBe(false);
    await expect(client.getJam('ABCDEF')).rejects.toMatchObject({ code: 'unavailable' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the delete key and accepts 204', async () => {
    const client = await loadClient('https://hub.example');
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await client.deleteSharedList('23456789AB', 'secret');
    const init = fetchMock.mock.calls[0]![1];
    expect(new Headers(init.headers).get('X-Delete-Key')).toBe('secret');
    expect(init.method).toBe('DELETE');
  });

  it('searches inside a jam', async () => {
    const client = await loadClient('https://hub.example');
    fetchMock.mockResolvedValue(json(200, { results: [{ id: 'a' }] }));
    const results = await client.searchInJam('ABCDEF', 'rock & roll', 'es');
    expect(results).toHaveLength(1);
    expect(fetchMock.mock.calls[0]![0]).toBe(
      'https://hub.example/hub/v1/jams/ABCDEF/search?q=rock+%26+roll&lang=es',
    );
  });

  it('maps https to wss and http to ws for the socket', async () => {
    expect((await loadClient('https://hub.example/')).jamSocketUrl('ABCDEF')).toBe(
      'wss://hub.example/hub/v1/jams/ABCDEF/ws',
    );
    expect((await loadClient('http://localhost:8787')).jamSocketUrl('ABCDEF')).toBe(
      'ws://localhost:8787/hub/v1/jams/ABCDEF/ws',
    );
  });
});
