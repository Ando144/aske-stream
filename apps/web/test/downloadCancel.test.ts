import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DownloadJob } from '../src/downloads/types';

const h = vi.hoisted(() => ({ home: 'cloudflare' }));

const cancelUpload = vi.fn(async (_id: string) => ({ deletedIds: [] as string[] }));
const load = vi.fn(async () => undefined);
const deleteTrack = vi.fn(async (_id: string) => undefined);

vi.mock('../src/api/client', () => ({
  api: { cancelUpload, sendUpdate: vi.fn(async () => undefined) },
  ApiError: class extends Error {},
}));
vi.mock('../src/stores/library', () => ({
  useLibrary: { getState: () => ({ load, deleteTrack }) },
}));
vi.mock('../src/stores/setup', () => ({
  useSetup: { getState: () => ({ config: { home: h.home } }) },
}));
vi.mock('../src/stores/serverUpdate', () => ({
  useServerUpdate: { getState: () => ({ markOutdated: vi.fn() }) },
}));
vi.mock('../src/stores/ui', () => ({ toast: vi.fn() }));
vi.mock('../src/native/downloader', () => ({
  Downloader: { cancel: vi.fn(async () => undefined), ack: vi.fn(async () => undefined) },
}));
vi.mock('../src/downloads/imports', () => ({ findInLibrary: () => undefined }));

const { createJobControls, discardSaved } = await import('../src/downloads/cancel');
const { requeuePatch } = await import('../src/downloads/jobsStore');

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
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => undefined });
});

describe('canceling a save', () => {
  it('cancels only its own upload in Cloudflare', async () => {
    cancelUpload.mockResolvedValueOnce({ deletedIds: ['own'] });
    await cancelJob({ target: 'home' });
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(cancelUpload).toHaveBeenCalledExactlyOnceWith('j1');
    expect(deleteTrack).not.toHaveBeenCalled();
  });

  it('cancels the renewed upload of a retried job', async () => {
    await cancelJob({ target: 'home', uploadId: 'renewed' });
    expect(cancelUpload).toHaveBeenCalledExactlyOnceWith('renewed');
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
  it('deletes exactly the song it saved', async () => {
    await discardSaved({ kind: 'saved', track: { id: 'own' }, timings: {} } as never);
    expect(deleteTrack).toHaveBeenCalledExactlyOnceWith('own');
  });

  it('keeps the song that was already in the library', async () => {
    await discardSaved({ kind: 'duplicate', trackId: 'old' });
    expect(deleteTrack).not.toHaveBeenCalled();
  });
});
