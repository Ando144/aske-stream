import { HUB_LIMITS, type JamSnapshot } from '@aske/shared/hub';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalTrack } from '../src/storage/types';

const h = vi.hoisted(() => ({
  add: vi.fn(),
  toast: vi.fn(),
  jam: {
    session: null as { role: 'host' | 'guest' } | null,
    connection: 'idle' as string,
    snapshot: null as unknown,
  },
  tracks: {} as Record<string, unknown>,
  player: { mode: 'track', currentId: null as string | null },
}));

vi.mock('../src/stores/jam', () => ({
  useJam: { getState: () => ({ ...h.jam, add: h.add }) },
}));
vi.mock('../src/stores/library', () => ({
  useLibrary: { getState: () => ({ tracks: h.tracks }) },
}));
vi.mock('../src/stores/player', () => ({
  usePlayer: { getState: () => h.player },
}));
vi.mock('../src/stores/ui', () => ({ toast: h.toast }));

import {
  addTracksToJam,
  filterLibrarySongs,
  jamIsActive,
  jamRoom,
  jamSongPlaying,
  planJamSend,
  toHubSong,
} from '../src/hub/jamFromLibrary';
import { t } from '../src/i18n';

const videoId = (n: number) => `vid${String(n).padStart(8, '0')}`;

function track(n: number, over: Partial<LocalTrack> = {}): LocalTrack {
  return {
    id: `t${n}`,
    title: `Title ${n}`,
    artist: 'Artist',
    album: '',
    durationMs: 1000,
    source: 'youtube',
    sourceRef: videoId(n),
    createdAt: n,
    ...over,
  } as LocalTrack;
}
const youtubeTracks = (count: number) => Array.from({ length: count }, (_, i) => track(i + 1));
const imported = (n: number) => track(n, { source: 'upload' as never, sourceRef: null });

const snapshot = (mine: number, others = 0, nowPlaying: unknown = null) =>
  ({
    nowPlaying,
    queue: [
      ...Array.from({ length: mine }, () => ({ mine: true })),
      ...Array.from({ length: others }, () => ({ mine: false })),
    ],
  }) as unknown as JamSnapshot;

function openJam(role: 'host' | 'guest' = 'guest') {
  h.jam.session = { role };
  h.jam.connection = 'open';
}

beforeEach(() => {
  vi.clearAllMocks();
  h.jam.session = null;
  h.jam.connection = 'idle';
  h.jam.snapshot = null;
  h.tracks = {};
  h.player = { mode: 'track', currentId: null };
});

describe('toHubSong', () => {
  it('turns a YouTube track into a hub song', () => {
    expect(toHubSong(track(1))).toEqual({
      videoId: videoId(1),
      title: 'Title 1',
      artist: 'Artist',
      durationMs: 1000,
    });
  });

  it('leaves out an unknown duration', () => {
    expect(toHubSong(track(1, { durationMs: 0 }))).not.toHaveProperty('durationMs');
  });

  it('rejects tracks that do not come from YouTube or have no valid video id', () => {
    expect(toHubSong(imported(1))).toBeNull();
    expect(toHubSong(track(1, { sourceRef: null }))).toBeNull();
    expect(toHubSong(track(1, { sourceRef: 'short' }))).toBeNull();
  });
});

describe('planJamSend', () => {
  it('sends only what fits and counts the rest as over the limit', () => {
    const plan = planJamSend(youtubeTracks(12), 10);
    expect(plan.songs).toHaveLength(10);
    expect(plan.songs[0]!.videoId).toBe(videoId(1));
    expect(plan).toMatchObject({ overLimit: 2, notYoutube: 0 });
  });

  it('counts non-YouTube tracks apart, without using room', () => {
    const plan = planJamSend([imported(1), track(2), imported(3)], 1);
    expect(plan.songs.map((s) => s.videoId)).toEqual([videoId(2)]);
    expect(plan).toMatchObject({ notYoutube: 2, overLimit: 0 });
  });

  it('sends nothing when there is no room', () => {
    expect(planJamSend(youtubeTracks(3), 0)).toMatchObject({ songs: [], overLimit: 3 });
  });
});

describe('jam state', () => {
  it('room is the limit minus my waiting songs, never negative', () => {
    expect(jamRoom()).toBe(HUB_LIMITS.jamMaxPendingPerMember);
    h.jam.snapshot = snapshot(3, 5);
    expect(jamRoom()).toBe(HUB_LIMITS.jamMaxPendingPerMember - 3);
    h.jam.snapshot = snapshot(HUB_LIMITS.jamMaxPendingPerMember + 1);
    expect(jamRoom()).toBe(0);
  });

  it('is active only with a session and an open connection', () => {
    expect(jamIsActive()).toBe(false);
    openJam();
    expect(jamIsActive()).toBe(true);
    h.jam.connection = 'reconnecting';
    expect(jamIsActive()).toBe(false);
  });

  it('knows when the host player is on the current Jam song', () => {
    openJam('host');
    h.tracks = { t1: track(1), t2: track(2) };
    h.jam.snapshot = snapshot(0, 0, { song: { videoId: videoId(1) } });
    h.player = { mode: 'track', currentId: 't1' };
    expect(jamSongPlaying()).toBe(true);
    h.player = { mode: 'track', currentId: 't2' };
    expect(jamSongPlaying()).toBe(false);
    h.player = { mode: 'radio', currentId: 't1' };
    expect(jamSongPlaying()).toBe(false);
  });

  it('is never true for guests or with nothing playing in the Jam', () => {
    h.tracks = { t1: track(1) };
    h.player = { mode: 'track', currentId: 't1' };
    openJam('guest');
    h.jam.snapshot = snapshot(0, 0, { song: { videoId: videoId(1) } });
    expect(jamSongPlaying()).toBe(false);
    openJam('host');
    h.jam.snapshot = snapshot(0);
    expect(jamSongPlaying()).toBe(false);
  });
});

describe('addTracksToJam', () => {
  const library = (tracks: LocalTrack[]) => {
    h.tracks = Object.fromEntries(tracks.map((tr) => [tr.id, tr]));
    return tracks.map((tr) => tr.id);
  };

  it('only warns when there is no open Jam', () => {
    addTracksToJam(library([track(1)]));
    expect(h.add).not.toHaveBeenCalled();
    expect(h.toast).toHaveBeenCalledWith(t('jamSend.offline'), 'error');
  });

  it('adds each song and confirms', () => {
    openJam();
    addTracksToJam(library(youtubeTracks(2)));
    expect(h.add).toHaveBeenCalledTimes(2);
    expect(h.toast).toHaveBeenCalledTimes(1);
    expect(h.toast).toHaveBeenCalledWith(t('jamSend.done', { count: 2 }));
  });

  it('shows one notice of each kind', () => {
    openJam();
    h.jam.snapshot = snapshot(HUB_LIMITS.jamMaxPendingPerMember - 1);
    addTracksToJam(library([track(1), track(2), imported(3)]));
    expect(h.add).toHaveBeenCalledTimes(1);
    expect(h.toast.mock.calls.map((c) => c[0])).toEqual([
      t('jamSend.done', { count: 1 }),
      t('jamSend.notYoutube', { count: 1 }),
      t('jamSend.limit', { count: 1, max: HUB_LIMITS.jamMaxPendingPerMember }),
    ]);
  });

  it('ignores ids that are no longer in the library', () => {
    openJam();
    addTracksToJam(['gone']);
    expect(h.add).not.toHaveBeenCalled();
    expect(h.toast).not.toHaveBeenCalled();
  });
});

describe('filterLibrarySongs', () => {
  const tracks = [
    track(1, { title: 'Corazón', artist: 'Pablo Alborán' }),
    track(2, { title: 'Otra', artist: 'Nadie', album: 'Éxitos' }),
    { ...imported(3), title: 'Corazón importado' },
  ];
  const ids = (found: LocalTrack[]) => found.map((tr) => tr.id);

  it('ignores accents and case, in title, artist and album', () => {
    expect(ids(filterLibrarySongs(tracks, 'CORAZON', 10))).toEqual(['t1']);
    expect(ids(filterLibrarySongs(tracks, 'alboran', 10))).toEqual(['t1']);
    expect(ids(filterLibrarySongs(tracks, ' exitos ', 10))).toEqual(['t2']);
    expect(filterLibrarySongs(tracks, 'zzz', 10)).toEqual([]);
  });

  it('without text returns only YouTube songs, newest first, up to max', () => {
    expect(ids(filterLibrarySongs(tracks, '', 10))).toEqual(['t2', 't1']);
    expect(ids(filterLibrarySongs(youtubeTracks(5), '', 2))).toEqual(['t5', 't4']);
    expect(filterLibrarySongs(youtubeTracks(5), 'title', 3)).toHaveLength(3);
  });
});
