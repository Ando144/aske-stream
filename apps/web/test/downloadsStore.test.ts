import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeResult } from '../src/downloads/types';

const h = vi.hoisted(() => ({
  listeners: {} as Record<string, (arg: never) => void>,
  home: 'device',
}));

const Downloader = {
  addListener: vi.fn(async (event: string, fn: (arg: never) => void) => {
    h.listeners[event] = fn;
    return { remove: async () => undefined };
  }),
  pending: vi.fn(async () => ({
    queued: [] as string[],
    current: null,
    results: [],
    waitingNetwork: false,
  })),
  queue: vi.fn(async (_arg: unknown) => undefined),
  ack: vi.fn(async () => undefined),
  cancel: vi.fn(async () => ({ canceled: true })),
  init: vi.fn(async () => ({ version: '1' })),
  updateEngine: vi.fn(async () => ({ updated: false, version: '1' })),
  setNotification: vi.fn(async () => undefined),
  requestNotifications: vi.fn(async () => ({ granted: true })),
};
const saveDownloaded = vi.fn();

vi.mock('../src/native/downloader', () => ({ Downloader, listPlaylistOnPhone: vi.fn() }));
vi.mock('../src/native/platform', () => ({ isNative: true }));
vi.mock('../src/downloads/save', () => ({ saveDownloaded }));
vi.mock('../src/downloads/imports', () => ({
  findInLibrary: () => undefined,
  resolvePlaylist: vi.fn(),
  rememberImport: vi.fn(),
  syncImport: vi.fn(),
  scheduleImportSync: vi.fn(),
  flushImportSync: vi.fn(async () => undefined),
  pruneImports: vi.fn(),
  settleImports: vi.fn(async () => undefined),
}));
vi.mock('../src/stores/setup', () => ({
  useSetup: { getState: () => ({ config: { home: h.home } }) },
}));
vi.mock('../src/stores/ui', () => ({ toast: vi.fn() }));
vi.mock('../src/api/client', () => ({ api: { sendUpdate: vi.fn(async () => undefined) } }));
vi.mock('../src/storage/drive/auth', () => ({ DriveAuthRequired: class extends Error {} }));
vi.mock('../src/lib/storage', () => ({
  loadValue: (_key: string, fallback: unknown) => fallback,
  savePref: () => undefined,
}));

const { useDownloads } = await import('../src/stores/downloads');

const ITEMS = ['a', 'b', 'c'].map((videoId) => ({ videoId, title: videoId, author: '' }));
const saved = { kind: 'saved', track: { id: 'tr' }, timings: {} };

function finish(jobId: string) {
  const result: NativeResult = {
    jobId,
    ok: true,
    path: '/x/a.webm',
    bytes: 10,
    ext: 'webm',
    info: { id: 'a', title: 'a' },
    elapsedMs: 5,
  };
  h.listeners.finished!(result as never);
}

const job = (i: number) => useDownloads.getState().jobs[i]!;
const status = (i: number) => job(i).status;

async function queueSongs(count: number) {
  await useDownloads.getState().enqueue(ITEMS.slice(0, count));
}

beforeEach(async () => {
  vi.clearAllMocks();
  Downloader.pending.mockResolvedValue({
    queued: [],
    current: null,
    results: [],
    waitingNetwork: false,
  });
  vi.stubGlobal('navigator', { onLine: true });
  h.home = 'device';
  useDownloads.setState({ jobs: [], saving: [], waitingNetwork: false });
  await useDownloads.getState().init();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('downloads store', () => {
  it('saves a finished download and acknowledges it', async () => {
    saveDownloaded.mockResolvedValue(saved);
    await queueSongs(1);
    expect(Downloader.queue).toHaveBeenCalledOnce();
    finish(job(0).id);
    await vi.waitFor(() => expect(status(0)).toBe('done'));
    expect(job(0).trackId).toBe('tr');
    expect(Downloader.ack).toHaveBeenCalledWith({ jobId: job(0).id });
  });

  it('keeps the file and waits when saving fails offline, then saves on resume', async () => {
    saveDownloaded.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 0 }));
    vi.stubGlobal('navigator', { onLine: false });
    await queueSongs(1);
    finish(job(0).id);
    await vi.waitFor(() => expect(useDownloads.getState().waitingNetwork).toBe(true));
    expect(status(0)).toBe('downloaded');
    saveDownloaded.mockResolvedValue(saved);
    vi.stubGlobal('navigator', { onLine: true });
    await useDownloads.getState().resume();
    await vi.waitFor(() => expect(status(0)).toBe('done'));
  });

  it('retries a network failure after 15 s by itself', async () => {
    vi.useFakeTimers();
    saveDownloaded.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 503 }));
    saveDownloaded.mockResolvedValue(saved);
    await queueSongs(1);
    const start = Date.now();
    finish(job(0).id);
    await vi.advanceTimersByTimeAsync(0);
    expect(status(0)).toBe('downloaded');
    expect(job(0).attempts).toBe(1);
    expect(job(0).retryAt).toBe(start + 15_000);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(status(0)).toBe('done');
  });

  it('saves at most 2 at once in Cloudflare', async () => {
    h.home = 'cloudflare';
    const gates: (() => void)[] = [];
    saveDownloaded.mockImplementation(
      () => new Promise((resolve) => gates.push(() => resolve(saved))),
    );
    await queueSongs(3);
    for (const j of useDownloads.getState().jobs) finish(j.id);
    await vi.waitFor(() => expect(saveDownloaded).toHaveBeenCalledTimes(2));
    expect(useDownloads.getState().saving).toHaveLength(2);
    gates[0]!();
    await vi.waitFor(() => expect(saveDownloaded).toHaveBeenCalledTimes(3));
    gates.forEach((open) => open());
  });

  it('fails without retrying when the error is not a network one', async () => {
    saveDownloaded.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
    await queueSongs(1);
    finish(job(0).id);
    await vi.waitFor(() => expect(status(0)).toBe('error'));
    expect(saveDownloaded).toHaveBeenCalledTimes(1);
    expect(job(0).attempts).toBeUndefined();
    expect(Downloader.ack).toHaveBeenCalledWith({ jobId: job(0).id });
  });

  it('flushes playlist imports before pruning them when the queue ends', async () => {
    const imports = await import('../src/downloads/imports');
    const order: string[] = [];
    vi.mocked(imports.flushImportSync).mockImplementation(async () => {
      order.push('flush');
    });
    vi.mocked(imports.pruneImports).mockImplementation(() => {
      order.push('prune');
    });
    saveDownloaded.mockResolvedValue(saved);
    await queueSongs(1);
    finish(job(0).id);
    await vi.waitFor(() => expect(order).toEqual(['flush', 'prune']));
  });

  it('clearFinished settles imports and keeps only the active jobs', async () => {
    const imports = await import('../src/downloads/imports');
    await queueSongs(2);
    useDownloads.setState({
      jobs: useDownloads.getState().jobs.map((j, i) => (i === 0 ? { ...j, status: 'done' } : j)),
    });
    await useDownloads.getState().clearFinished();
    expect(useDownloads.getState().jobs).toHaveLength(1);
    expect(status(0)).toBe('queued');
    expect(imports.settleImports).toHaveBeenCalledOnce();
  });

  it('cancelAll cancels every job on the phone and settles imports once', async () => {
    const imports = await import('../src/downloads/imports');
    await queueSongs(3);
    await useDownloads.getState().cancelAll();
    expect(Downloader.cancel).toHaveBeenCalledTimes(3);
    expect(imports.settleImports).toHaveBeenCalledOnce();
    expect(useDownloads.getState().jobs.every((j) => j.status === 'canceled')).toBe(true);
  });

  it('cancel of a downloaded job acknowledges it instead of canceling', async () => {
    saveDownloaded.mockReturnValue(new Promise(() => undefined));
    await queueSongs(1);
    useDownloads.setState({
      jobs: useDownloads.getState().jobs.map((j) => ({ ...j, status: 'downloaded' as const })),
    });
    await useDownloads.getState().cancel(job(0).id);
    expect(Downloader.ack).toHaveBeenCalledWith({ jobId: job(0).id });
    expect(Downloader.cancel).not.toHaveBeenCalled();
    expect(status(0)).toBe('canceled');
  });

  it('resume restarts the phone service when it still has a queue but nothing is new', async () => {
    Downloader.pending.mockResolvedValue({
      queued: ['x'],
      current: null,
      results: [],
      waitingNetwork: false,
    });
    await useDownloads.getState().resume();
    expect(Downloader.queue).toHaveBeenCalledWith(
      expect.objectContaining({
        jobs: [],
        texts: expect.objectContaining({ paused: expect.any(String) }),
      }),
    );
  });

  it('resume does not call the phone queue when it has nothing', async () => {
    Downloader.pending.mockResolvedValue({
      queued: [],
      current: null,
      results: [],
      waitingNetwork: false,
    });
    await useDownloads.getState().resume();
    expect(Downloader.queue).not.toHaveBeenCalled();
  });

  it('sends the paused notification text with new jobs', async () => {
    await queueSongs(1);
    const arg = Downloader.queue.mock.calls[0]![0] as { texts: { paused: string } };
    expect(typeof arg.texts.paused).toBe('string');
  });

  it('does not show waiting for internet on resume when nothing is active', async () => {
    useDownloads.setState({ jobs: [], waitingNetwork: true });
    vi.stubGlobal('navigator', { onLine: false });
    await useDownloads.getState().resume();
    expect(useDownloads.getState().waitingNetwork).toBe(false);
  });
});
