import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Playlist } from '@aske/shared';
import type { HomeKind, LocalTrack } from '../src/storage/types';

const fake = vi.hoisted(() => ({
  kind: 'cloudflare' as string,
  extras: [] as unknown[],
  kv: new Map<string, unknown>(),
  toast: vi.fn(),
  api: {
    load: vi.fn(),
    updateTrack: vi.fn(),
    deleteTrack: vi.fn(),
    createPlaylist: vi.fn(),
    addToPlaylist: vi.fn(),
    reorderPlaylist: vi.fn(),
  },
  local: {
    listLocalExtras: vi.fn(),
    updateLocalExtra: vi.fn(),
    deleteLocalExtra: vi.fn(),
  },
}));

vi.mock('../src/stores/setup', () => ({
  getHome: () => fake.api,
  useSetup: { getState: () => ({ config: { home: fake.kind } }) },
}));
vi.mock('../src/offline/db', () => ({
  kvGet: async (key: string) => fake.kv.get(key),
  kvSet: async (key: string, value: unknown) => void fake.kv.set(key, value),
}));
vi.mock('../src/storage/localExtras', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/storage/localExtras')>()),
  ...fake.local,
}));
vi.mock('../src/stores/ui', () => ({ toast: fake.toast }));
vi.mock('../src/stores/connectivity', () => ({
  useConnectivity: { getState: () => ({ reportTrouble() {} }) },
}));
vi.mock('../src/stores/serverUpdate', () => ({
  useServerUpdate: { getState: () => ({ markOutdated() {} }) },
}));

import { t } from '../src/i18n';
import { mergeExtras } from '../src/storage/libraryMerge';
import { useLibrary } from '../src/stores/library';

const track = (id: string, createdAt: number, patch: Partial<LocalTrack> = {}): LocalTrack => ({
  id,
  title: id,
  artist: '',
  album: '',
  durationMs: 1000,
  sizeBytes: 1000,
  bitrateKbps: null,
  hasCover: false,
  source: 'youtube',
  sourceRef: id,
  createdAt,
  likedAt: null,
  kind: 'music',
  locations: { cloudflare: id },
  mime: 'audio/ogg',
  ...patch,
});
const extra = (id: string, createdAt: number) =>
  track(id, createdAt, { locations: { device: true } });

const playlist = (id: string, trackIds: string[] = []) =>
  ({ id, name: 'List', trackIds }) as unknown as Playlist;

const cloud = [track('c2', 30), track('c1', 10)];
const snapshot = () => ({ etag: 'e1', tracks: cloud, playlists: [playlist('p')], folders: [] });
const cacheKey = () => `library:${fake.kind}`;
const cachedIds = () =>
  (fake.kv.get(cacheKey()) as { library: { tracks: LocalTrack[] } }).library.tracks.map(
    (tr) => tr.id,
  );
const state = () => useLibrary.getState();

beforeEach(() => {
  vi.clearAllMocks();
  fake.kind = 'cloudflare' satisfies HomeKind;
  fake.kv.clear();
  fake.extras = [extra('x', 20)];
  fake.local.listLocalExtras.mockImplementation(async () => fake.extras);
  fake.local.updateLocalExtra.mockResolvedValue(undefined);
  fake.local.deleteLocalExtra.mockResolvedValue(undefined);
  fake.api.load.mockResolvedValue(snapshot());
  fake.api.createPlaylist.mockImplementation(async (_name: string, ids: string[]) =>
    playlist('new', ids),
  );
  fake.api.addToPlaylist.mockImplementation(async (id: string, ids: string[]) => playlist(id, ids));
  fake.api.reorderPlaylist.mockImplementation(async (id: string, ids: string[]) =>
    playlist(id, ids),
  );
  useLibrary.setState({
    loaded: false,
    loading: false,
    error: null,
    tracks: {},
    order: [],
    playlists: [],
    folders: [],
  });
});

describe('mergeExtras', () => {
  it('places extras by creation date, newest first, without repeating ids', () => {
    const merged = mergeExtras(cloud, [
      extra('old', 1),
      extra('c1', 99),
      extra('mid', 20),
      extra('new', 40),
    ]);
    expect(merged.map((tr) => tr.id)).toEqual(['new', 'c2', 'mid', 'c1', 'old']);
    expect(merged.find((tr) => tr.id === 'c1')).toBe(cloud[1]);
  });
});

describe('load with songs only on this phone', () => {
  it('adds them to a library coming from the network, but not to the home cache', async () => {
    await state().load();
    expect(state().order).toEqual(['c2', 'x', 'c1']);
    expect(state().tracks.x).toEqual(extra('x', 20));
    expect(cachedIds()).toEqual(['c2', 'c1']);
  });

  it('adds them to the cached copy when the home has nothing new', async () => {
    const { etag, ...library } = snapshot();
    fake.kv.set(cacheKey(), { etag, library, savedAt: 1 });
    fake.api.load.mockResolvedValue(null);
    await state().load();
    expect(state().order).toEqual(['c2', 'x', 'c1']);
  });

  it('keeps them out of the cache after a change is saved', async () => {
    await state().load();
    fake.api.updateTrack.mockResolvedValue(undefined);
    await state().toggleLike('c1');
    expect(cachedIds()).toEqual(['c2', 'c1']);
  });

  it('ignores them when the library lives on the device', async () => {
    fake.kind = 'device';
    await state().load();
    expect(state().order).toEqual(['c2', 'c1']);
    expect(fake.local.listLocalExtras).not.toHaveBeenCalled();
  });

  it('still shows the cloud library and warns if they cannot be read', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fake.local.listLocalExtras.mockRejectedValue(new Error('broken'));
    await state().load();
    expect(state().order).toEqual(['c2', 'c1']);
    expect(fake.toast).toHaveBeenCalledWith(t('toast.error'), 'error');
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('writes on songs only on this phone', () => {
  beforeEach(() => state().load());

  it('likes them in the local store, never in the home', async () => {
    await state().toggleLike('x');
    expect(fake.local.updateLocalExtra).toHaveBeenCalledWith('x', { liked: true });
    expect(fake.api.updateTrack).not.toHaveBeenCalled();
  });

  it('splits a bulk like between both stores', async () => {
    await state().likeMany(['x', 'c1']);
    expect(fake.local.updateLocalExtra.mock.calls).toEqual([['x', { liked: true }]]);
    expect(fake.api.updateTrack.mock.calls).toEqual([['c1', { liked: true }]]);
  });

  it('changes their kind in the local store', async () => {
    await state().setKind('x', 'podcast');
    expect(fake.local.updateLocalExtra).toHaveBeenCalledWith('x', { kind: 'podcast' });
    expect(fake.api.updateTrack).not.toHaveBeenCalled();
  });

  it('deletes them from the local store, never from the home', async () => {
    await state().deleteTrack('x');
    expect(fake.local.deleteLocalExtra).toHaveBeenCalledWith('x');
    expect(fake.api.deleteTrack).not.toHaveBeenCalled();
    expect(state().order).toEqual(['c2', 'c1']);
  });
});

describe('playlists and songs only on this phone', () => {
  beforeEach(() => state().load());

  it('leaves them out when adding and says why', async () => {
    await state().addToPlaylist('p', ['x', 'c1']);
    expect(fake.api.addToPlaylist).toHaveBeenCalledWith('p', ['c1']);
    expect(fake.toast).toHaveBeenCalledWith(t('local.notInPlaylists', { count: 1 }));
  });

  it('does not call the home when nothing is left to add', async () => {
    await state().addToPlaylist('p', ['x']);
    expect(fake.api.addToPlaylist).not.toHaveBeenCalled();
    expect(fake.toast.mock.calls).toEqual([[t('local.notInPlaylists', { count: 1 })]]);
  });

  it('stays quiet for background additions', async () => {
    await state().addToPlaylist('p', ['x', 'c1'], true);
    expect(fake.api.addToPlaylist).toHaveBeenCalledWith('p', ['c1']);
    expect(fake.toast).not.toHaveBeenCalled();
  });

  it('creates a playlist without them', async () => {
    await state().createPlaylist('Mix', ['c1', 'x']);
    expect(fake.api.createPlaylist).toHaveBeenCalledWith('Mix', ['c1']);
    expect(fake.toast).toHaveBeenCalledWith(t('local.notInPlaylists', { count: 1 }));
  });

  it('does not create a playlist when only such songs were chosen', async () => {
    expect(await state().createPlaylist('Mix', ['x'])).toBeNull();
    expect(fake.api.createPlaylist).not.toHaveBeenCalled();
  });

  it('still creates empty playlists', async () => {
    await state().createPlaylist('Empty');
    expect(fake.api.createPlaylist).toHaveBeenCalledWith('Empty', []);
  });

  it('never sends them in a new playlist order', async () => {
    await state().reorderPlaylist('p', ['x', 'c1', 'c2']);
    expect(fake.api.reorderPlaylist).toHaveBeenCalledWith('p', ['c1', 'c2']);
    expect(state().playlists[0]!.trackIds).toEqual(['c1', 'c2']);
  });
});
