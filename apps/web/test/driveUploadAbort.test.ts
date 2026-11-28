import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/storage/drive/auth', () => ({
  getDriveToken: async () => 'token',
  invalidateDriveToken: () => undefined,
}));

const { driveApi } = await import('../src/storage/drive/api');

const SESSION = 'https://upload.example/session-1';
const meta = { name: 'song.webm', mimeType: 'audio/webm', parentId: 'folder' };

interface Sent {
  url: string;
  method: string;
  range: string | null;
}

/** Google as seen through fetch; the caller cancels while the bytes are being sent. */
function fakeGoogle(
  status: () => Response,
  { cancel = true, onDelete = async () => new Response(null, { status: 204 }) } = {},
) {
  const controller = new AbortController();
  const sent: Sent[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const method = init.method ?? 'GET';
      const range = new Headers(init.headers).get('Content-Range');
      sent.push({ url, method, range });
      if (method === 'POST') return new Response(null, { headers: { Location: SESSION } });
      if (method === 'DELETE') return url === SESSION ? onDelete() : new Response(null);
      if (range) return status();
      if (cancel) controller.abort();
      throw new DOMException('Aborted', 'AbortError');
    }),
  );
  const upload = () => driveApi.upload(meta, new Blob(['12345']), { signal: controller.signal });
  const deleted = () => sent.filter((s) => s.method === 'DELETE').map((s) => s.url);
  return { sent, upload, deleted };
}

const finished = (status: number) => () => Response.json({ id: 'file-9' }, { status });
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('canceling a Drive upload', () => {
  it.each([200, 201])('ends the session and deletes only the finished file (%i)', async (code) => {
    const google = fakeGoogle(finished(code));
    await expect(google.upload()).rejects.toThrow('Aborted');
    await settle();
    expect(google.sent.slice(2, 4)).toEqual([
      { url: SESSION, method: 'DELETE', range: null },
      { url: SESSION, method: 'PUT', range: 'bytes */5' },
    ]);
    expect(google.deleted()).toEqual([SESSION, expect.stringMatching(/\/files\/file-9$/)]);
  });

  it('deletes no file when the upload never finished', async () => {
    const google = fakeGoogle(() => new Response(null, { status: 499 }));
    await expect(google.upload()).rejects.toThrow('Aborted');
    await settle();
    expect(google.deleted()).toEqual([SESSION]);
  });

  it('still checks for the file when ending the session fails', async () => {
    const google = fakeGoogle(finished(200), {
      onDelete: async () => {
        throw new TypeError('offline');
      },
    });
    await expect(google.upload()).rejects.toThrow('Aborted');
    await settle();
    expect(google.deleted()).toHaveLength(2);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('logs a failed check without hiding the cancellation', async () => {
    const google = fakeGoogle(() => {
      throw new TypeError('offline');
    });
    await expect(google.upload()).rejects.toThrow('Aborted');
    await settle();
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('leaves the session alone when the upload just failed', async () => {
    const google = fakeGoogle(finished(200), { cancel: false });
    await expect(google.upload()).rejects.toMatchObject({ code: 'network_error' });
    await settle();
    expect(google.sent).toHaveLength(2);
  });
});
