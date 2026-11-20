import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const addToPlaylist = vi.fn(async () => undefined);
const reorderPlaylist = vi.fn(async () => undefined);
const libraryState = {
  tracks: {
    t1: { id: 't1', source: 'youtube', sourceRef: 'a' },
    t2: { id: 't2', source: 'youtube', sourceRef: 'b' },
  },
  playlists: [{ id: 'p1', trackIds: [] as string[] }],
  addToPlaylist,
  reorderPlaylist,
};

vi.mock('../src/stores/library', () => ({
  useLibrary: { getState: () => libraryState },
}));
vi.mock('../src/stores/offline', () => ({ useOffline: {} }));
vi.mock('../src/storage/drive/home', () => ({ driveHome: {} }));
vi.mock('../src/storage/homes', () => ({
  deviceHome: {},
  fromRemote: vi.fn(),
  newLocalId: vi.fn(),
}));
vi.mock('../src/storage/deviceFiles', () => ({
  deleteDeviceFile: vi.fn(),
  saveDeviceFile: vi.fn(),
}));
vi.mock('../src/native/downloader', () => ({ Downloader: {} }));
vi.mock('../src/api/client', () => ({ api: {}, ApiError: class extends Error {} }));
vi.mock('../src/lib/storage', () => ({
  loadValue: (_key: string, fallback: unknown) => fallback,
  savePref: () => undefined,
}));

const { uploadTimeoutMs } = await import('../src/downloads/save');
const { rememberImport, scheduleImportSync, flushImportSync } =
  await import('../src/downloads/imports');

describe('uploadTimeoutMs', () => {
  it('gives at least two minutes to small files', () => {
    expect(uploadTimeoutMs(1024 * 1024)).toBe(120_000);
  });

  it('grows with the size of big files', () => {
    expect(uploadTimeoutMs(10 * 1024 * 1024)).toBeGreaterThan(120_000);
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
