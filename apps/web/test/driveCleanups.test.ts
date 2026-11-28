import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DriveFile, UploadOptions } from '../src/storage/drive/api';

const h = vi.hoisted(() => ({ home: 'drive' as string | null }));

const findByUploadId = vi.fn(async (_id: string) => [] as DriveFile[]);
const remove = vi.fn(async (_id: string) => undefined);
const referencedFileIds = vi.fn(async () => new Set<string>());

vi.mock('../src/storage/drive/api', () => ({ driveApi: { findByUploadId, remove } }));
vi.mock('../src/storage/drive/home', () => ({ driveHome: { referencedFileIds } }));
vi.mock('../src/stores/setup', () => ({
  useSetup: { getState: () => ({ config: h.home ? { home: h.home } : null }) },
}));
vi.mock('../src/offline/db', () => ({
  kvGet: async () => ({
    doc: {
      tracks: {
        t1: { audioFileId: 'a1', coverFileId: 'c1' },
        t2: { audioFileId: 'a2', coverFileId: null },
      },
    },
  }),
  kvSet: async () => undefined,
}));
vi.mock('../src/storage/drive/auth', () => ({
  getDriveToken: async () => 'token',
  invalidateDriveToken: () => undefined,
}));

const { registerDriveCleanup, retryDriveCleanups } = await import('../src/downloads/driveCleanups');

const KEY = 'aske.driveCleanups.v1';
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const stored = new Map<string, string>();
const network = { onLine: true };
const pending = () => (JSON.parse(stored.get(KEY) ?? '[]') as { id: string }[]).map((p) => p.id);
const save = (list: unknown) => stored.set(KEY, JSON.stringify(list));
const old = (id: string) => ({ id, at: Date.now() - 3 * MINUTE });
const files = (...ids: string[]) => ids.map((id) => ({ id, name: id }));
const removed = () => remove.mock.calls.map(([id]) => id);

beforeEach(() => {
  vi.useFakeTimers();
  findByUploadId.mockReset().mockResolvedValue([]);
  remove.mockReset().mockResolvedValue(undefined);
  referencedFileIds.mockReset().mockResolvedValue(new Set());
  stored.clear();
  h.home = 'drive';
  network.onLine = true;
  vi.stubGlobal('navigator', network);
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

describe('cleaning up a canceled Drive upload', () => {
  it('notes it and tries after 2 minutes, not before', async () => {
    findByUploadId.mockResolvedValue(files('audio'));
    registerDriveCleanup('u1');
    expect(pending()).toEqual(['u1']);
    await vi.advanceTimersByTimeAsync(2 * MINUTE - 1);
    expect(findByUploadId).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(findByUploadId).toHaveBeenCalledExactlyOnceWith('u1');
    expect(removed()).toEqual(['audio']);
    expect(pending()).toEqual([]);
  });

  it('keeps a single entry per upload', () => {
    registerDriveCleanup('u1');
    registerDriveCleanup('u1');
    expect(pending()).toEqual(['u1']);
  });

  it('removes the files of that upload but never one the library uses', async () => {
    findByUploadId.mockResolvedValue(files('audio', 'cover'));
    referencedFileIds.mockResolvedValue(new Set(['cover']));
    save([old('u1')]);
    await retryDriveCleanups();
    expect(findByUploadId).toHaveBeenCalledExactlyOnceWith('u1');
    expect(removed()).toEqual(['audio']);
    expect(pending()).toEqual(['u1']);
  });

  it('forgets it once nothing is found after 2 minutes', async () => {
    save([old('u1')]);
    await retryDriveCleanups();
    expect(pending()).toEqual([]);
  });

  it('does not forget it before 2 minutes, even if nothing is found', async () => {
    save([{ id: 'u1', at: Date.now() - 2 * MINUTE + 1 }]);
    await retryDriveCleanups();
    expect(findByUploadId).toHaveBeenCalledOnce();
    expect(pending()).toEqual(['u1']);
  });

  it('keeps it without network and does not call Drive', async () => {
    network.onLine = false;
    save([old('u1')]);
    await retryDriveCleanups();
    expect(findByUploadId).not.toHaveBeenCalled();
    expect(pending()).toEqual(['u1']);
  });

  it.each([
    ['searching', findByUploadId],
    ['reading the library', referencedFileIds],
    ['deleting', remove],
  ])('keeps it and logs when %s fails', async (_step, mock) => {
    findByUploadId.mockResolvedValue(files('audio'));
    mock.mockRejectedValueOnce(new Error('Drive down'));
    save([old('u1')]);
    await expect(retryDriveCleanups()).resolves.toBeUndefined();
    expect(pending()).toEqual(['u1']);
    expect(console.error).toHaveBeenCalledOnce();
  });

  it('goes on with the next one when one fails', async () => {
    findByUploadId.mockRejectedValueOnce(new Error('Drive down'));
    save([old('u1'), old('u2')]);
    await retryDriveCleanups();
    expect(pending()).toEqual(['u1']);
  });

  it.each(['device', 'cloudflare'])('forgets it when the library lives in %s', async (home) => {
    h.home = home;
    save([old('u1')]);
    await retryDriveCleanups();
    expect(findByUploadId).not.toHaveBeenCalled();
    expect(pending()).toEqual([]);
  });

  it('waits while the setup is not known', async () => {
    h.home = null;
    save([old('u1')]);
    await retryDriveCleanups();
    expect(findByUploadId).not.toHaveBeenCalled();
    expect(pending()).toEqual(['u1']);
  });

  it('drops entries older than 30 days, even without network', async () => {
    network.onLine = false;
    save([
      { id: 'old', at: Date.now() - 31 * DAY },
      { id: 'recent', at: Date.now() - 29 * DAY },
    ]);
    await retryDriveCleanups();
    expect(pending()).toEqual(['recent']);
  });

  it.each(['not json', '{"id":"u1"}', '[null,{"id":1}]'])(
    'ignores a damaged list (%s)',
    async (raw) => {
      stored.set(KEY, raw);
      await retryDriveCleanups();
      expect(findByUploadId).not.toHaveBeenCalled();
    },
  );
});

describe('the Drive requests', () => {
  const meta = { name: 'song.webm', mimeType: 'audio/webm', parentId: 'folder' };
  const realApi = async () =>
    (await vi.importActual<typeof import('../src/storage/drive/api')>('../src/storage/drive/api'))
      .driveApi;

  async function uploadedDetails(opts: UploadOptions) {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) =>
      init.method === 'POST'
        ? new Response(null, { headers: { Location: 'https://upload.example/s' } })
        : Response.json({ id: 'f1' }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await (await realApi()).upload(meta, new Blob(['1']), opts);
    return JSON.parse(fetchMock.mock.calls[0]![1].body as string) as Record<string, unknown>;
  }

  it('marks the file with the upload id', async () => {
    expect(await uploadedDetails({ uploadId: 'u1' })).toMatchObject({
      appProperties: { askeUploadId: 'u1' },
    });
  });

  it('adds no mark without an upload id', async () => {
    expect(await uploadedDetails({})).not.toHaveProperty('appProperties');
  });

  it('searches by upload id, escaping it', async () => {
    const fetchMock = vi.fn(async (_url: string) => Response.json({ files: files('a', 'b') }));
    vi.stubGlobal('fetch', fetchMock);
    const found = await (await realApi()).findByUploadId("u'1");
    expect(found.map((f) => f.id)).toEqual(['a', 'b']);
    const url = new URL(fetchMock.mock.calls[0]![0]);
    expect(url.searchParams.get('q')).toBe(
      "appProperties has { key='askeUploadId' and value='u\\'1' } and trashed=false",
    );
  });
});

describe('the files the library uses', () => {
  it('lists the audio and cover of every song', async () => {
    const { driveHome } = await vi.importActual<typeof import('../src/storage/drive/home')>(
      '../src/storage/drive/home',
    );
    expect(await driveHome.referencedFileIds()).toEqual(new Set(['a1', 'c1', 'a2']));
  });
});
