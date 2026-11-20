import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface FakePlaylist {
  id: string;
  name: string;
  trackIds: string[];
}

const store = new Map<string, unknown>();
let playlists: FakePlaylist[] = [];
let running = 0;
let maxRunning = 0;
let addDelayMs = 0;
const addToPlaylist = vi.fn(async (id: string, trackIds: string[]) => {
  running++;
  maxRunning = Math.max(maxRunning, running);
  await new Promise((r) => setTimeout(r, addDelayMs));
  const p = playlists.find((x) => x.id === id)!;
  playlists = playlists.map((x) =>
    x === p ? { ...x, trackIds: [...x.trackIds, ...trackIds] } : x,
  );
  running--;
});
const reorderPlaylist = vi.fn(async (id: string, trackIds: string[]) => {
  playlists = playlists.map((x) => (x.id === id ? { ...x, trackIds } : x));
});
const tracks = {
  t1: { id: 't1', source: 'youtube', sourceRef: 'v1' },
  t2: { id: 't2', source: 'youtube', sourceRef: 'v2' },
};

vi.mock('../src/stores/library', () => ({
  useLibrary: {
    getState: () => ({
      tracks,
      playlists,
      addToPlaylist,
      reorderPlaylist,
      createPlaylist: vi.fn(),
    }),
  },
}));
vi.mock('../src/lib/storage', () => ({
  loadValue: (key: string, fallback: unknown) => (store.has(key) ? store.get(key) : fallback),
  savePref: (key: string, value: unknown) => void store.set(key, value),
}));

async function load() {
  vi.resetModules();
  return import('../src/downloads/imports');
}

beforeEach(() => {
  store.clear();
  playlists = [{ id: 'p', name: 'P', trackIds: [] }];
  running = 0;
  maxRunning = 0;
  addDelayMs = 0;
  addToPlaylist.mockClear();
  reorderPlaylist.mockClear();
});
afterEach(() => vi.useRealTimers());

describe('flushImportSync', () => {
  it('never overlaps calls and settleImports leaves the songs in the playlist', async () => {
    const m = await load();
    addDelayMs = 20;
    m.rememberImport('p', ['v1', 'v2']);
    m.scheduleImportSync('v1');
    const order: string[] = [];
    const first = m.flushImportSync().then(() => order.push('first'));
    m.scheduleImportSync('v2');
    const second = m.flushImportSync().then(() => order.push('second'));
    await Promise.all([first, second]);
    expect(order).toEqual(['first', 'second']);
    expect(maxRunning).toBe(1);

    await m.settleImports(() => [
      { videoId: 'v1', status: 'done' },
      { videoId: 'v2', status: 'done' },
    ]);
    expect(playlists[0]!.trackIds).toEqual(['t1', 't2']);
    expect(store.get('downloads-imports-v1')).toEqual([]);
  });

  it('keeps the chain alive after a failed flush', async () => {
    const m = await load();
    m.rememberImport('p', ['v1']);
    m.scheduleImportSync('v1');
    addToPlaylist.mockRejectedValueOnce(new Error('boom'));
    await expect(m.flushImportSync()).rejects.toThrow('boom');
    m.scheduleImportSync('v1');
    await expect(m.flushImportSync()).resolves.toBeUndefined();
    expect(playlists[0]!.trackIds).toEqual(['t1']);
  });
});

describe('scheduleImportSync', () => {
  it('groups close calls into one sync after 4 s', async () => {
    vi.useFakeTimers();
    const m = await load();
    m.rememberImport('p', ['v1', 'v2']);
    m.scheduleImportSync('v1');
    await vi.advanceTimersByTimeAsync(2000);
    m.scheduleImportSync('v2');
    await vi.advanceTimersByTimeAsync(3999);
    expect(addToPlaylist).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(addToPlaylist).toHaveBeenCalledTimes(1);
    expect(addToPlaylist.mock.calls[0]![1]).toEqual(['t1', 't2']);
  });
});

describe('settleImports', () => {
  it('reads the jobs after the flush, not before', async () => {
    const m = await load();
    addDelayMs = 10;
    m.rememberImport('p', ['v1']);
    m.scheduleImportSync('v1');
    const getJobs = vi.fn(() => {
      expect(addToPlaylist).toHaveBeenCalled();
      return [{ videoId: 'v1', status: 'done' as const }];
    });
    await m.settleImports(getJobs);
    expect(getJobs).toHaveBeenCalledTimes(1);
  });
});

describe('pruneImports', () => {
  it.each(['downloading', 'error', 'canceled'] as const)(
    'keeps an import with a %s song',
    async (status) => {
      const m = await load();
      m.rememberImport('p', ['v1']);
      m.pruneImports([{ videoId: 'v1', status }]);
      expect(store.get('downloads-imports-v1')).toHaveLength(1);
    },
  );

  it('forgets an import whose songs are all done', async () => {
    const m = await load();
    m.rememberImport('p', ['v1']);
    m.pruneImports([{ videoId: 'v1', status: 'done' }]);
    expect(store.get('downloads-imports-v1')).toEqual([]);
  });
});
