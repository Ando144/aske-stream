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

vi.mock('../src/api/client', () => ({ api: { cancelUpload }, ApiError: h.ApiError }));
vi.mock('../src/stores/library', () => ({ useLibrary: { getState: () => ({ load }) } }));
vi.mock('../src/stores/serverUpdate', () => ({
  useServerUpdate: { getState: () => ({ markOutdated }) },
}));
vi.mock('../src/stores/setup', () => ({
  useSetup: { getState: () => ({ config: h.home ? { home: h.home } : null }) },
}));

const { cancelCloudUpload, retryPendingCancels } = await import('../src/downloads/uploadCancels');

const KEY = 'aske.uploadCancels.v1';
const DAY = 24 * 3600 * 1000;
const stored = new Map<string, string>();
const pending = () =>
  (JSON.parse(stored.get(KEY) ?? '[]') as { id: string; at: number }[]).map((p) => p.id);
const save = (list: unknown) => stored.set(KEY, JSON.stringify(list));
const offline = () => new h.ApiError(0, 'network_error', 'No connection');

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

  it('marks an old server as outdated and forgets the cancellation', async () => {
    cancelUpload.mockRejectedValue(new h.ApiError(404, 'not_found', 'Unknown endpoint'));
    await cancelCloudUpload('j1');
    expect(markOutdated).toHaveBeenCalledOnce();
    expect(pending()).toEqual([]);
    expect(load).not.toHaveBeenCalled();
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
