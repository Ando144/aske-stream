import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addToPlaylist = vi.fn(async () => undefined);
const reorderPlaylist = vi.fn(async () => undefined);
const upsertTracks = vi.fn();
const adopt = vi.fn(async () => undefined);
const uploadTrack = vi.fn(async () => ({ id: 'r1' }));
const putLocalExtra = vi.fn(async (_track: unknown) => undefined);
const saveDeviceFile = vi.fn(async (_kind: string, _id: string, _data: Blob) => undefined);
const deleteDeviceFile = vi.fn(async (_kind: string, _id: string) => undefined);
const libraryState = {
  tracks: {
    t1: { id: 't1', source: 'youtube', sourceRef: 'a' },
    t2: { id: 't2', source: 'youtube', sourceRef: 'b' },
  },
  playlists: [{ id: 'p1', trackIds: [] as string[] }],
  addToPlaylist,
  reorderPlaylist,
  upsertTracks,
};

vi.mock('../src/stores/library', () => ({
  useLibrary: { getState: () => libraryState },
}));
vi.mock('../src/stores/offline', () => ({ useOffline: { getState: () => ({ adopt }) } }));
vi.mock('../src/storage/localExtras', () => ({ putLocalExtra }));
vi.mock('../src/lib/cover', () => ({ squareJpeg: vi.fn(async () => null) }));
vi.mock('@capacitor/core', () => ({ Capacitor: { convertFileSrc: (p: string) => p } }));
vi.mock('../src/storage/drive/home', () => ({ driveHome: {} }));
vi.mock('../src/storage/homes', () => ({
  deviceHome: {},
  fromRemote: vi.fn(),
  newLocalId: () => 'local1',
}));
vi.mock('../src/storage/deviceFiles', () => ({ deleteDeviceFile, saveDeviceFile }));
vi.mock('../src/native/downloader', () => ({
  Downloader: {
    fetchImage: vi.fn(async () => ({ path: '/cover.jpg' })),
    deleteFile: vi.fn(async () => undefined),
  },
}));
vi.mock('../src/api/client', () => ({
  api: { uploadTrack },
  ApiError: class extends Error {},
}));
vi.mock('../src/lib/storage', () => ({
  loadValue: (_key: string, fallback: unknown) => fallback,
  savePref: () => undefined,
}));

const { uploadTimeoutMs, saveDeviceOnly, saveDownloaded } = await import('../src/downloads/save');
const { rememberImport, scheduleImportSync, flushImportSync } =
  await import('../src/downloads/imports');

describe('uploadTimeoutMs', () => {
  it('gives at least two minutes to small files', () => {
    expect(uploadTimeoutMs(1024 * 1024)).toBe(120_000);
  });

  it('grows with the size of big files', () => {
    expect(uploadTimeoutMs(20 * 1024 * 1024)).toBe(320_000);
  });

  it('never waits more than 30 minutes', () => {
    expect(uploadTimeoutMs(90 * 1024 * 1024)).toBeLessThanOrEqual(30 * 60_000);
    expect(uploadTimeoutMs(500 * 1024 * 1024)).toBe(30 * 60_000);
  });
});

describe('saving a downloaded file', () => {
  const job = { id: 'j', videoId: 'v', title: 'T', author: 'Author', keepOffline: true };
  const file = {
    path: '/a.webm',
    bytes: 96 * 1024 * 1024,
    ext: 'webm',
    info: { id: 'v', title: 'Episode 1', channel: 'The Show', duration: 7200 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('audio')),
    );
    vi.stubGlobal('navigator', { onLine: true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('keeps the audio on the phone, with the channel as the show, and never uploads', async () => {
    const outcome = await saveDeviceOnly(job as never, file);
    expect(outcome).toMatchObject({
      kind: 'saved',
      track: { id: 'local1', album: 'The Show', kind: 'music', locations: { device: true } },
    });
    expect(saveDeviceFile).toHaveBeenCalledWith('audio', 'local1', expect.anything());
    expect(putLocalExtra).toHaveBeenCalledOnce();
    expect(upsertTracks).toHaveBeenCalledOnce();
    expect(uploadTrack).not.toHaveBeenCalled();
    expect(adopt).not.toHaveBeenCalled();
  });

  it('removes both files when writing fails', async () => {
    saveDeviceFile.mockRejectedValueOnce(new Error('disk'));
    await expect(saveDeviceOnly(job as never, file)).rejects.toThrow('disk');
    expect(deleteDeviceFile).toHaveBeenCalledWith('audio', 'local1');
    expect(deleteDeviceFile).toHaveBeenCalledWith('covers', 'local1');
    expect(putLocalExtra).not.toHaveBeenCalled();
  });

  it('adds nothing when canceled while writing', async () => {
    const controller = new AbortController();
    saveDeviceFile.mockImplementationOnce(async () => {
      controller.abort();
      return undefined;
    });
    await expect(saveDeviceOnly(job as never, file, controller.signal)).rejects.toThrow();
    expect(putLocalExtra).not.toHaveBeenCalled();
    expect(deleteDeviceFile).toHaveBeenCalledWith('audio', 'local1');
  });

  it('sends the job id as the upload id, so that exact upload can be canceled', async () => {
    await saveDownloaded({ ...job, keepOffline: false } as never, file, 'cloudflare');
    const [form] = uploadTrack.mock.calls[0] as unknown as [FormData];
    expect(JSON.parse(form.get('meta') as string)).toMatchObject({ uploadId: 'j' });
  });

  it('sends the renewed upload id of a retried job', async () => {
    const retried = { ...job, uploadId: 'renewed', keepOffline: false };
    await saveDownloaded(retried as never, file, 'cloudflare');
    const [form] = uploadTrack.mock.calls[0] as unknown as [FormData];
    expect(JSON.parse(form.get('meta') as string)).toMatchObject({ uploadId: 'renewed' });
  });

  it('does not upload when canceled before the upload starts', async () => {
    const signal = AbortSignal.abort();
    await expect(saveDownloaded(job as never, file, 'cloudflare', signal)).rejects.toThrow();
    expect(uploadTrack).not.toHaveBeenCalled();
  });
});

describe('scheduleImportSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    addToPlaylist.mockClear();
    reorderPlaylist.mockClear();
    rememberImport('p1', ['a', 'b']);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups many calls into one sync per import', async () => {
    for (let i = 0; i < 5; i++) {
      scheduleImportSync(i % 2 ? 'a' : 'b');
      await vi.advanceTimersByTimeAsync(600);
    }
    expect(addToPlaylist).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(4000);
    expect(addToPlaylist).toHaveBeenCalledTimes(1);
  });

  it('flushImportSync runs the pending sync right away', async () => {
    scheduleImportSync('a');
    await flushImportSync();
    expect(addToPlaylist).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(addToPlaylist).toHaveBeenCalledTimes(1);
  });
});
