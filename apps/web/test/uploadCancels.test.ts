import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return { ApiError, home: 'cloudflare' as string | null };
});

const cancelUpload = vi.fn(async (_id: string) => ({ deletedIds: [] as string[] }));
const load = vi.fn(async () => undefined);
const markOutdated = vi.fn();
const retryDriveCleanups = vi.fn(async () => undefined);

vi.mock('../src/api/client', () => ({ api: { cancelUpload }, ApiError: h.ApiError }));
vi.mock('../src/downloads/driveCleanups', () => ({ retryDriveCleanups }));
vi.mock('../src/stores/library', () => ({ useLibrary: { getState: () => ({ load }) } }));
vi.mock('../src/stores/serverUpdate', () => ({
  useServerUpdate: { getState: () => ({ markOutdated }) },
}));
vi.mock('../src/stores/setup', () => ({
  useSetup: { getState: () => ({ config: h.home ? { home: h.home } : null }) },
}));

const { cancelCloudUpload, forgetCancelsFor, retryPendingCancels } =
  await import('../src/downloads/uploadCancels');

const KEY = 'aske.uploadCancels.v1';
const DAY = 24 * 3600 * 1000;
const stored = new Map<string, string>();
const pending = () =>
  (JSON.parse(stored.get(KEY) ?? '[]') as { id: string; at: number }[]).map((p) => p.id);
const save = (list: unknown) => stored.set(KEY, JSON.stringify(list));
const offline = () => new h.ApiError(0, 'network_error', 'No connection');
const HINT = { ref: 'vid', since: 1000 };

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  cancelUpload.mockReset().mockResolvedValue({ deletedIds: [] });
  stored.clear();
  h.home = 'cloudflare';
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => void stored.set(key, value),
  });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('canceling a cloud upload', () => {
  it('tells the server right away and forgets it', async () => {
    await cancelCloudUpload('j1');
    expect(cancelUpload).toHaveBeenCalledExactlyOnceWith('j1');
    expect(pending()).toEqual([]);
    expect(load).not.toHaveBeenCalled();
  });

  it('reloads the library when the server deleted a song', async () => {
    cancelUpload.mockResolvedValueOnce({ deletedIds: ['r1'] });
    await cancelCloudUpload('j1');
    expect(load).toHaveBeenCalledOnce();
  });

  it('tries again after 5 s and after 60 s', async () => {
    cancelUpload.mockRejectedValue(offline());
    const done = cancelCloudUpload('j1');
    await vi.advanceTimersByTimeAsync(4_999);
    expect(cancelUpload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(cancelUpload).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(55_000);
    expect(cancelUpload).toHaveBeenCalledTimes(3);
    await done;
    expect(pending()).toEqual(['j1']);
    expect(console.error).toHaveBeenCalledTimes(3);
  });

  it('keeps it pending without network and sends it when retried', async () => {
    cancelUpload.mockRejectedValue(offline());
    const done = cancelCloudUpload('j1');
    await vi.advanceTimersByTimeAsync(60_000);
    await done;
    cancelUpload.mockReset().mockResolvedValue({ deletedIds: ['r1'] });
    await retryPendingCancels();
    expect(cancelUpload).toHaveBeenCalledExactlyOnceWith('j1');
    expect(pending()).toEqual([]);
    expect(load).toHaveBeenCalledOnce();
  });

  it('stops retrying once another attempt got through', async () => {
    cancelUpload.mockRejectedValueOnce(offline());
    const done = cancelCloudUpload('j1');
    await vi.advanceTimersByTimeAsync(0);
    await retryPendingCancels();
    await vi.advanceTimersByTimeAsync(60_000);
    await done;
    expect(cancelUpload).toHaveBeenCalledTimes(2);
  });

  it('keeps the cancellation while the server is old, and sends it once updated', async () => {
    cancelUpload.mockRejectedValue(new h.ApiError(404, 'not_found', 'Unknown endpoint'));
    await cancelCloudUpload('j1', HINT);
    expect(markOutdated).toHaveBeenCalledOnce();
    expect(pending()).toEqual(['j1']);
    expect(load).not.toHaveBeenCalled();
    cancelUpload.mockReset().mockResolvedValue({ deletedIds: ['r1'] });
    await retryPendingCancels();
    expect(cancelUpload).toHaveBeenCalledExactlyOnceWith('j1', HINT);
    expect(pending()).toEqual([]);
    expect(load).toHaveBeenCalledOnce();
  });

  it('retries the Drive cleanups too', async () => {
    await retryPendingCancels();
    expect(retryDriveCleanups).toHaveBeenCalledOnce();
  });

  it('drops the cancellation when the library no longer lives in Cloudflare', async () => {
    h.home = 'drive';
    save([{ id: 'j1', at: Date.now() }]);
    await retryPendingCancels();
    expect(cancelUpload).not.toHaveBeenCalled();
    expect(pending()).toEqual([]);
  });

  it('waits while the setup is not known', async () => {
    h.home = null;
    save([{ id: 'j1', at: Date.now() }]);
    await retryPendingCancels();
    expect(cancelUpload).not.toHaveBeenCalled();
    expect(pending()).toEqual(['j1']);
  });

  it('drops cancellations older than 30 days', async () => {
    save([
      { id: 'old', at: Date.now() - 31 * DAY },
      { id: 'recent', at: Date.now() - 29 * DAY },
    ]);
    await retryPendingCancels();
    expect(cancelUpload).toHaveBeenCalledExactlyOnceWith('recent');
    expect(pending()).toEqual([]);
  });

  it.each(['not json', '{"id":"j1"}', '[null,{"id":1}]'])(
    'ignores a damaged list (%s)',
    async (raw) => {
      stored.set(KEY, raw);
      await retryPendingCancels();
      expect(cancelUpload).not.toHaveBeenCalled();
    },
  );
});

describe('forgetting the song hint of a video', () => {
  it('removes it and keeps the cancellation by upload id', async () => {
    save([
      { id: 'j1', at: Date.now(), ...HINT },
      { id: 'j2', at: Date.now(), ref: 'other', since: 5 },
    ]);
    forgetCancelsFor('vid');
    expect(pending()).toEqual(['j1', 'j2']);
    await retryPendingCancels();
    expect(cancelUpload.mock.calls).toEqual([['j1'], ['j2', { ref: 'other', since: 5 }]]);
  });

  it('also applies to the attempts already scheduled', async () => {
    cancelUpload.mockRejectedValueOnce(offline());
    const done = cancelCloudUpload('j1', HINT);
    await vi.advanceTimersByTimeAsync(0);
    forgetCancelsFor('vid');
    await vi.advanceTimersByTimeAsync(5_000);
    await done;
    expect(cancelUpload.mock.calls).toEqual([['j1', HINT], ['j1']]);
  });
});

describe('the cancel request', () => {
  it.each([
    [undefined, '/api/ingest/uploads/j1'],
    [HINT, '/api/ingest/uploads/j1?ref=vid&since=1000'],
  ])('sends the song hint %o in the address', async (legacy, url) => {
    const real = await vi.importActual<typeof import('../src/api/client')>('../src/api/client');
    const fetchMock = vi.fn(async () => Response.json({ deletedIds: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await real.api.cancelUpload('j1', legacy);
    expect(fetchMock).toHaveBeenCalledWith(url, expect.objectContaining({ method: 'DELETE' }));
  });
});
