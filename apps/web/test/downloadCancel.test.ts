import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadJob } from '../src/downloads/types';

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
  return {
    ApiError,
    home: 'cloudflare',
    library: { tracks: {}, order: [] as string[], playlists: [] as unknown[] },
    cloud: null as unknown,
    inLibrary: undefined as { id: string } | undefined,
  };
});

const cancelUpload = vi.fn(async (_id: string) => ({ deletedIds: [] as string[] }));
const load = vi.fn(async () => undefined);
const deleteRemote = vi.fn(async (_id: string) => undefined);
const deleteExtra = vi.fn(async (_id: string) => undefined);
const persist = vi.fn(async () => undefined);
const toast = vi.fn();
const registerDriveCleanup = vi.fn();

vi.mock('../src/api/client', () => ({
  api: { cancelUpload, deleteTrack: deleteRemote, sendUpdate: vi.fn(async () => undefined) },
  ApiError: h.ApiError,
}));
vi.mock('../src/stores/library', () => ({
  useLibrary: {
    getState: () => ({ ...h.library, load }),
    setState: (patch: object) => Object.assign(h.library, patch),
  },
}));
vi.mock('../src/stores/libraryCache', () => ({
  extrasStore: { deleteTrack: deleteExtra },
  persist,
}));
vi.mock('../src/stores/setup', () => ({
  useSetup: { getState: () => ({ config: { home: h.home } }) },
  getHome: () => h.cloud,
}));
vi.mock('../src/downloads/driveCleanups', () => ({
  registerDriveCleanup,
  retryDriveCleanups: vi.fn(async () => undefined),
}));
vi.mock('../src/stores/serverUpdate', () => ({
  useServerUpdate: { getState: () => ({ markOutdated: vi.fn() }) },
}));
vi.mock('../src/stores/ui', () => ({ toast }));
vi.mock('../src/native/downloader', () => ({
  Downloader: {
    cancel: vi.fn(async () => undefined),
    ack: vi.fn(async () => undefined),
    requestNotifications: vi.fn(async () => ({ granted: true })),
  },
}));
vi.mock('../src/native/platform', () => ({ isNative: true }));
vi.mock('../src/downloads/imports', () => ({ findInLibrary: () => h.inLibrary }));

const { createJobControls, discardSaved } = await import('../src/downloads/cancel');
const { requeuePatch } = await import('../src/downloads/jobsStore');
const { cloudflareHome } = await import('../src/storage/homes');
const { t } = await import('../src/i18n');
const { useDownloads } = await import('../src/stores/downloads');
h.cloud = cloudflareHome;

/** Cancels a job through the real controls, as the X button does. */
async function cancelJob(patch: Partial<DownloadJob> = {}) {
  let jobs = [{ id: 'j1', videoId: 'vid', status: 'saving', ...patch } as DownloadJob];
  const controls = createJobControls({
    get: () => ({ jobs, saving: [] }) as never,
    set: () => undefined,
    update: (id, change) => {
      jobs = jobs.map((j) => (j.id === id ? { ...j, ...change } : j));
    },
  });
  await controls.cancel('j1');
}

beforeEach(() => {
  vi.clearAllMocks();
  h.home = 'cloudflare';
  h.inLibrary = undefined;
  deleteRemote.mockReset().mockResolvedValue(undefined);
  h.library = {
    tracks: { own: { id: 'own' }, old: { id: 'old' } },
    order: ['own', 'old'],
    playlists: [{ id: 'p', trackIds: ['own', 'old'] }],
  };
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
});

describe('canceling a save', () => {
  it('cancels only its own upload in Cloudflare, with a hint for old servers', async () => {
    cancelUpload.mockResolvedValueOnce({ deletedIds: ['own'] });
    await cancelJob({ target: 'home', savingSince: 1_000_000 });
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(cancelUpload).toHaveBeenCalledExactlyOnceWith('j1', { ref: 'vid', since: 400_000 });
    expect(deleteRemote).not.toHaveBeenCalled();
  });

  it('cancels the renewed upload of a retried job', async () => {
    await cancelJob({ target: 'home', uploadId: 'renewed' });
    expect(cancelUpload).toHaveBeenCalledExactlyOnceWith('renewed', expect.anything());
  });

  it.each([
    [{}, 'j1'],
    [{ uploadId: 'renewed' }, 'renewed'],
  ])('notes the Drive cleanup of the upload (%o)', async (patch, uploadId) => {
    h.home = 'drive';
    await cancelJob({ target: 'home', ...patch });
    expect(registerDriveCleanup).toHaveBeenCalledExactlyOnceWith(uploadId);
  });

  it.each([
    ['drive', { target: 'device-only' }],
    ['drive', { status: 'queued' }],
    ['cloudflare', { target: 'home' }],
    ['device', { target: 'home' }],
  ] as const)('notes no Drive cleanup (%s, %o)', async (home, patch) => {
    h.home = home;
    await cancelJob(patch);
    expect(registerDriveCleanup).not.toHaveBeenCalled();
  });

  it.each(['drive', 'device'])('does not ask the Worker with a %s library', async (home) => {
    h.home = home;
    await cancelJob({ target: 'home' });
    expect(cancelUpload).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it('does not ask the Worker for a file that stays on the phone', async () => {
    await cancelJob({ target: 'device-only' });
    expect(cancelUpload).not.toHaveBeenCalled();
  });

  it('does not ask the Worker when nothing was being saved', async () => {
    await cancelJob({ status: 'queued' });
    expect(cancelUpload).not.toHaveBeenCalled();
  });
});

describe('asking again for a song that is already in the library', () => {
  it('drops the hint, so a pending cancellation does not delete it later', async () => {
    const pending = { id: 'j1', at: 1, ref: 'vid', since: 1 };
    const stored = new Map([['aske.uploadCancels.v1', JSON.stringify([pending])]]);
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    });
    h.inLibrary = { id: 'own' };
    await useDownloads.getState().enqueue([{ videoId: 'vid', title: 'vid', author: '' }]);
    expect(useDownloads.getState().jobs[0]?.status).toBe('skipped');
    expect(JSON.parse(stored.get('aske.uploadCancels.v1')!)).toEqual([{ id: 'j1', at: 1 }]);
  });
});

describe('retrying a job', () => {
  it('gives it a new upload id, so an earlier cancellation does not block it', () => {
    const first = requeuePatch('b1').uploadId;
    const second = requeuePatch('b1').uploadId;
    // The format the Worker accepts (apps/api/src/lib/uploads.ts).
    expect(first).toMatch(/^[A-Za-z0-9_-]{1,100}$/);
    expect(second).not.toBe(first);
  });
});

describe('a save that ended after being stopped', () => {
  const saved = (locations: object) =>
    ({ kind: 'saved', track: { id: 'own', locations }, timings: {} }) as never;
  const remaining = { order: ['old'], playlists: [{ id: 'p', trackIds: ['old'] }] };

  it('deletes exactly the song it saved, without any notice', async () => {
    await discardSaved(saved({ cloudflare: 'own' }));
    expect(deleteRemote).toHaveBeenCalledExactlyOnceWith('own');
    expect(h.library).toMatchObject(remaining);
    expect(h.library.tracks).toEqual({ old: { id: 'old' } });
    expect(persist).toHaveBeenCalledOnce();
    expect(toast).not.toHaveBeenCalled();
  });

  it('shows no error when the server had already deleted it', async () => {
    deleteRemote.mockRejectedValueOnce(new h.ApiError(404, 'not_found', 'Track not found'));
    await discardSaved(saved({ cloudflare: 'own' }));
    expect(h.library).toMatchObject(remaining);
    expect(toast).not.toHaveBeenCalled();
  });

  it('keeps the song and says why when it could not be deleted', async () => {
    deleteRemote.mockRejectedValueOnce(new h.ApiError(0, 'network_error', 'No connection'));
    await discardSaved(saved({ cloudflare: 'own' }));
    expect(h.library.order).toEqual(['own', 'old']);
    expect(toast).toHaveBeenCalledExactlyOnceWith(t('toast.offline'), 'error');
  });

  it('deletes a song kept only on the phone from the phone', async () => {
    await discardSaved(saved({ device: true }));
    expect(deleteExtra).toHaveBeenCalledExactlyOnceWith('own');
    expect(deleteRemote).not.toHaveBeenCalled();
    expect(h.library).toMatchObject(remaining);
  });

  it('keeps the song that was already in the library', async () => {
    await discardSaved({ kind: 'duplicate', trackId: 'old' });
    expect(deleteRemote).not.toHaveBeenCalled();
    expect(h.library.order).toEqual(['own', 'old']);
  });
});
