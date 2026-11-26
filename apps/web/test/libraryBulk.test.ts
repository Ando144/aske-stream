import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalTrack } from '../src/storage/types';

const fake = vi.hoisted(() => ({
  toast: vi.fn(),
  updateTrack: vi.fn(),
  updateLocalExtra: vi.fn(),
}));

vi.mock('../src/stores/setup', () => ({
  getHome: () => ({ updateTrack: fake.updateTrack }),
  useSetup: { getState: () => ({ config: { home: 'cloudflare' } }) },
}));
vi.mock('../src/offline/db', () => ({ kvGet: async () => undefined, kvSet: async () => {} }));
vi.mock('../src/storage/localExtras', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/storage/localExtras')>()),
  updateLocalExtra: fake.updateLocalExtra,
}));
vi.mock('../src/stores/ui', () => ({ toast: fake.toast }));
vi.mock('../src/stores/connectivity', () => ({
  useConnectivity: { getState: () => ({ reportTrouble() {} }) },
}));
vi.mock('../src/stores/serverUpdate', () => ({
  useServerUpdate: { getState: () => ({ markOutdated() {} }) },
}));

import { t } from '../src/i18n';
import { useLibrary } from '../src/stores/library';

const track = (id: string, patch: Partial<LocalTrack> = {}): LocalTrack => ({
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
  createdAt: 1,
  likedAt: null,
  kind: 'music',
  locations: { cloudflare: id },
  mime: 'audio/ogg',
  ...patch,
});

const initial = {
  a: track('a'),
  b: track('b'),
  x: track('x', { locations: { device: true } }),
};
const state = () => useLibrary.getState();
const pick = <K extends keyof LocalTrack>(key: K) =>
  ['a', 'b', 'x'].map((id) => state().tracks[id]![key]);

beforeEach(() => {
  vi.clearAllMocks();
  fake.updateTrack.mockResolvedValue(undefined);
  fake.updateLocalExtra.mockResolvedValue(undefined);
  useLibrary.setState({ tracks: initial, order: ['a', 'b', 'x'], playlists: [], folders: [] });
});

describe('setKindMany', () => {
  it('moves every song, each one in its own store', async () => {
    await state().setKindMany(['a', 'b', 'x'], 'podcast');
    expect(pick('kind')).toEqual(['podcast', 'podcast', 'podcast']);
    expect(fake.updateTrack.mock.calls).toEqual([
      ['a', { kind: 'podcast' }],
      ['b', { kind: 'podcast' }],
    ]);
    expect(fake.updateLocalExtra.mock.calls).toEqual([['x', { kind: 'podcast' }]]);
    expect(fake.toast).toHaveBeenCalledWith(t('toast.movedToPodcastsMany', { count: 3 }));
  });

  it('skips songs already of that kind and unknown ids', async () => {
    useLibrary.setState({ tracks: { ...initial, a: track('a', { kind: 'podcast' }) } });
    await state().setKindMany(['a', 'b', 'missing'], 'podcast');
    expect(fake.updateTrack.mock.calls).toEqual([['b', { kind: 'podcast' }]]);
    expect(state().tracks).not.toHaveProperty('missing');
    expect(fake.toast).toHaveBeenCalledWith(t('toast.movedToPodcastsMany', { count: 2 }));
  });

  it('confirms a move back to music', async () => {
    useLibrary.setState({ tracks: { ...initial, a: track('a', { kind: 'podcast' }) } });
    await state().setKindMany(['a'], 'music');
    expect(pick('kind')).toEqual(['music', 'music', 'music']);
    expect(fake.toast).toHaveBeenCalledWith(t('toast.movedToMusic'));
  });

  it('puts everything back if one write fails', async () => {
    fake.updateTrack.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom'));
    await state().setKindMany(['a', 'b', 'x'], 'podcast');
    expect(state().tracks).toEqual(initial);
    expect(fake.toast.mock.calls).toEqual([[t('toast.error'), 'error']]);
  });
});

describe('setAlbumMany', () => {
  it('changes the show of every episode, each one in its own store', async () => {
    await state().setAlbumMany(['a', 'b', 'x'], 'Show');
    expect(pick('album')).toEqual(['Show', 'Show', 'Show']);
    expect(fake.updateTrack.mock.calls).toEqual([
      ['a', { album: 'Show' }],
      ['b', { album: 'Show' }],
    ]);
    expect(fake.updateLocalExtra.mock.calls).toEqual([['x', { album: 'Show' }]]);
    expect(fake.toast).toHaveBeenCalledWith(
      t('podcasts.toast.showChanged', { count: 3, name: 'Show' }),
    );
  });

  it('puts everything back if one write fails', async () => {
    fake.updateLocalExtra.mockRejectedValue(new Error('boom'));
    await state().setAlbumMany(['a', 'b', 'x'], 'Show');
    expect(state().tracks).toEqual(initial);
    expect(fake.toast.mock.calls).toEqual([[t('toast.error'), 'error']]);
  });
});
