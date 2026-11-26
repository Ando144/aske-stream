import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NativeResult } from '../src/downloads/types';

const h = vi.hoisted(() => ({
  listeners: {} as Record<string, (arg: never) => void>,
  home: 'device',
  saved: [] as unknown[],
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
  setNotification: vi.fn(async (_arg: unknown) => undefined),
  clearDoneNotice: vi.fn(async () => undefined),
  requestNotifications: vi.fn(async () => ({ granted: true })),
};
const saveDownloaded = vi.fn();
const saveDeviceOnly = vi.fn();
const deleteTrack = vi.fn(async () => undefined);

vi.mock('../src/native/downloader', () => ({ Downloader, listPlaylistOnPhone: vi.fn() }));
vi.mock('../src/native/platform', () => ({ isNative: true }));
vi.mock('../src/downloads/save', () => ({ saveDownloaded, saveDeviceOnly }));
vi.mock('../src/stores/library', () => ({ useLibrary: { getState: () => ({ deleteTrack }) } }));
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
  loadValue: (key: string, fallback: unknown) =>
    key === 'downloads-v1' && h.saved.length ? h.saved : fallback,
  savePref: () => undefined,
}));

const { useDownloads } = await import('../src/stores/downloads');

const ITEMS = ['a', 'b', 'c'].map((videoId) => ({ videoId, title: videoId, author: '' }));
const saved = { kind: 'saved', track: { id: 'tr' }, timings: {} };

function finish(jobId: string, bytes = 10) {
  const result: NativeResult = {
    jobId,
    ok: true,
    path: '/x/a.webm',
    bytes,
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
  h.saved = [];
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

  it('closes the progress notice with the final text when the queue empties', async () => {
    const { t } = await import('../src/i18n');
    saveDownloaded.mockResolvedValue(saved);
    await queueSongs(3);
    for (const j of useDownloads.getState().jobs) finish(j.id);
    await vi.waitFor(() =>
      expect(Downloader.setNotification).toHaveBeenLastCalledWith(
        expect.objectContaining({ active: false }),
      ),
    );
    const calls = Downloader.setNotification.mock.calls.map((c) => c[0]);
    expect(calls.at(-1)).toEqual({ active: false, doneText: t('dl.notifDone', { count: 3 }) });
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

const MB = 1024 * 1024;
const never = () => new Promise(() => undefined);

describe('stuck and long saves', () => {
  async function startSave() {
    await queueSongs(1);
    finish(job(0).id);
    await vi.waitFor(() => expect(status(0)).toBe('saving'));
  }
  const signalOfSave = () => saveDownloaded.mock.calls[0]![3] as AbortSignal;

  it('cancels a job that is being saved, without planning a retry', async () => {
    saveDownloaded.mockImplementation(
      (_job, _file, _home, signal: AbortSignal) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        }),
    );
    await startSave();
    await useDownloads.getState().cancel(job(0).id);
    expect(signalOfSave().aborted).toBe(true);
    expect(status(0)).toBe('canceled');
    expect(job(0).retryAt).toBeUndefined();
    expect(useDownloads.getState().saving).toEqual([]);
    expect(Downloader.ack).toHaveBeenCalledWith({ jobId: job(0).id });
    const { toast } = await import('../src/stores/ui');
    const { t } = await import('../src/i18n');
    expect(toast).toHaveBeenCalledWith(t('dl.toast.canceledSaving'));
  });

  it('deletes the song when the save ends after being canceled', async () => {
    let end: () => void = () => undefined;
    saveDownloaded.mockImplementation(() => new Promise((resolve) => (end = () => resolve(saved))));
    await startSave();
    await useDownloads.getState().cancel(job(0).id);
    end();
    await vi.waitFor(() => expect(deleteTrack).toHaveBeenCalledWith('tr'));
    expect(status(0)).toBe('canceled');
  });

  it('keeps audio over 95 MB only on the phone in Cloudflare', async () => {
    h.home = 'cloudflare';
    saveDeviceOnly.mockResolvedValue(saved);
    await queueSongs(1);
    finish(job(0).id, 96 * MB);
    await vi.waitFor(() => expect(status(0)).toBe('done'));
    expect(job(0).target).toBe('device-only');
    expect(saveDownloaded).not.toHaveBeenCalled();
    const { toast } = await import('../src/stores/ui');
    const { t } = await import('../src/i18n');
    const { formatBytes } = await import('../src/lib/format');
    expect(toast).toHaveBeenCalledWith(
      t('dl.toast.savedLocal', { title: 'a', size: formatBytes(96 * MB) }),
    );
  });

  it('saves a small song while two big podcasts are still saving', async () => {
    h.home = 'cloudflare';
    saveDownloaded.mockImplementation(never);
    saveDeviceOnly.mockImplementation(never);
    await queueSongs(3);
    const [a, b, c] = useDownloads.getState().jobs;
    finish(a!.id, 100 * MB);
    finish(b!.id, 40 * MB);
    finish(c!.id, MB);
    await vi.waitFor(() => expect(status(2)).toBe('saving'));
    expect([status(0), status(1)]).toEqual(['saving', 'saving']);
  });

  it('moves a persisted oversized save to the phone on start', async () => {
    h.home = 'cloudflare';
    h.saved = [
      {
        id: 'old',
        videoId: 'a',
        title: 'a',
        status: 'saving',
        createdAt: 1,
        file: { path: '/x', bytes: 100 * MB, ext: 'webm', info: { id: 'a' } },
      },
    ];
    saveDeviceOnly.mockResolvedValue(saved);
    await useDownloads.getState().init();
    await vi.waitFor(() => expect(status(0)).toBe('done'));
    expect(saveDeviceOnly).toHaveBeenCalledOnce();
    expect(saveDownloaded).not.toHaveBeenCalled();
  });

  it('keeps a 40 MB audio on the phone after two server errors', async () => {
    vi.useFakeTimers();
    h.home = 'cloudflare';
    saveDownloaded.mockRejectedValue(Object.assign(new Error('x'), { status: 502 }));
    saveDeviceOnly.mockResolvedValue(saved);
    await queueSongs(1);
    finish(job(0).id, 40 * MB);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(saveDownloaded).toHaveBeenCalledTimes(2);
    expect(saveDeviceOnly).toHaveBeenCalledOnce();
    expect(status(0)).toBe('done');
    const { toast } = await import('../src/stores/ui');
    const { t } = await import('../src/i18n');
    expect(toast).toHaveBeenCalledWith(t('dl.toast.savedLocalFailed', { title: 'a' }));
  });

  it('waits for the network with a big audio while offline', async () => {
    h.home = 'cloudflare';
    vi.stubGlobal('navigator', { onLine: false });
    saveDownloaded.mockRejectedValue(Object.assign(new Error('x'), { status: 0 }));
    await queueSongs(1);
    finish(job(0).id, 40 * MB);
    await vi.waitFor(() => expect(useDownloads.getState().waitingNetwork).toBe(true));
    expect(status(0)).toBe('downloaded');
    expect(saveDeviceOnly).not.toHaveBeenCalled();
    saveDownloaded.mockResolvedValue(saved);
    vi.stubGlobal('navigator', { onLine: true });
    await useDownloads.getState().resume();
    await vi.waitFor(() => expect(status(0)).toBe('done'));
  });

  it('keeps saving phone-only audio while the cloud waits for the network', async () => {
    h.home = 'cloudflare';
    vi.stubGlobal('navigator', { onLine: false });
    saveDownloaded.mockRejectedValue(Object.assign(new Error('x'), { status: 0 }));
    saveDeviceOnly.mockResolvedValue(saved);
    await queueSongs(2);
    const [small, big] = useDownloads.getState().jobs;
    finish(small!.id);
    await vi.waitFor(() => expect(useDownloads.getState().waitingNetwork).toBe(true));
    finish(big!.id, 100 * MB);
    await vi.waitFor(() => expect(status(1)).toBe('done'));
    expect(status(0)).toBe('downloaded');
    expect(saveDownloaded).toHaveBeenCalledTimes(1);
    saveDownloaded.mockResolvedValue(saved);
    vi.stubGlobal('navigator', { onLine: true });
    await useDownloads.getState().resume();
    await vi.waitFor(() => expect(status(0)).toBe('done'));
  });

  it('fails a save that outlives its time limit', async () => {
    vi.useFakeTimers();
    saveDownloaded.mockImplementation(never);
    await queueSongs(1);
    finish(job(0).id);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    const { t } = await import('../src/i18n');
    expect(status(0)).toBe('error');
    expect(job(0).error).toBe(t('dl.err.saveTooSlow'));
    expect(signalOfSave().aborted).toBe(true);
    expect(useDownloads.getState().saving).toEqual([]);
  });

  it('explains a failed phone-only save', async () => {
    h.home = 'cloudflare';
    saveDeviceOnly.mockRejectedValue(new TypeError('Failed to fetch'));
    await queueSongs(1);
    finish(job(0).id, 100 * MB);
    await vi.waitFor(() => expect(status(0)).toBe('error'));
    const { t } = await import('../src/i18n');
    expect(job(0).error).toBe(t('dl.err.localFailed'));
  });

  it('removes a failed job and its file from the list', async () => {
    saveDownloaded.mockRejectedValue(Object.assign(new Error('bad'), { status: 400 }));
    await queueSongs(1);
    const id = job(0).id;
    finish(id);
    await vi.waitFor(() => expect(status(0)).toBe('error'));
    Downloader.ack.mockClear();
    await useDownloads.getState().remove(id);
    expect(useDownloads.getState().jobs).toEqual([]);
    expect(Downloader.ack).toHaveBeenCalledWith({ jobId: id });
  });
});
