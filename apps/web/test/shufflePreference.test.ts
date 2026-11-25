import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const store = vi.hoisted(() => {
  class FakeAudio {
    src = '';
    currentSrc = '';
    currentTime = 0;
    duration = NaN;
    volume = 1;
    muted = false;
    paused = true;
    preload = '';
    playbackRate = 1;
    defaultPlaybackRate = 1;
    addEventListener() {}
    removeEventListener() {}
    pause() {}
    canPlayType() {
      return '';
    }
    play() {
      return Promise.resolve();
    }
  }
  const g = globalThis as Record<string, unknown>;
  g.Audio = FakeAudio;
  g.window = { addEventListener() {} };
  g.URL = Object.assign(URL, { revokeObjectURL() {} });
  return { values: {} as Record<string, unknown>, saved: [] as [string, unknown][] };
});

vi.mock('../src/lib/storage', () => ({
  loadValue: (key: string, fallback: unknown) =>
    key in store.values ? store.values[key] : fallback,
  loadPref: (_key: string, fallback: unknown) => fallback,
  savePref: (key: string, value: unknown) => store.saved.push([key, value]),
}));
vi.mock('../src/storage/media', () => ({ resolveAudio: async () => 'https://x/audio' }));
vi.mock('../src/player/mediaSession', () => ({
  createMediaSession: () => ({
    keepAwake() {},
    renewAwake() {},
    setPlaybackState() {},
    updatePositionState() {},
    updateMediaSession() {},
    setStalled() {},
    setRetryHandler() {},
  }),
}));
vi.mock('../src/stores/library', async () => {
  const { create } = await import('zustand');
  return { useLibrary: create(() => ({ tracks: {} as Record<string, object>, order: [] })) };
});
vi.mock('../src/stores/offline', async () => {
  const { create } = await import('zustand');
  return {
    LISTENED_THRESHOLD: 0.8,
    setProtectedProvider() {},
    useOffline: create(() => ({ entries: {}, scheduleRun() {} })),
  };
});
vi.mock('../src/stores/podcasts', async () => {
  const { create } = await import('zustand');
  return { resumePosition: () => 0, usePodcasts: create(() => ({ rate: 1, setRate() {} })) };
});
vi.mock('../src/stores/prefs', async () => {
  const { create } = await import('zustand');
  return { usePrefs: create(() => ({ dataSaver: false })) };
});
vi.mock('../src/stores/radio', () => ({ catalog: { click: async () => {} } }));
vi.mock('../src/stores/ui', () => ({ toast() {} }));
vi.mock('../src/native/platform', () => ({ isNative: false }));
vi.mock('../src/lib/power', () => ({ mayRotateOfflineNow: () => false }));

import type { PlayContext } from '../src/player/types';
import type { LocalTrack } from '../src/storage/types';
import { usePlayer } from '../src/stores/player';
import { useLibrary } from '../src/stores/library';

const ctx: PlayContext = { label: 'L', path: '/l', cycleKey: 'l' };
const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);
const flush = () => new Promise((r) => setTimeout(r, 0));
const play = usePlayer.getState;
const initial = usePlayer.getState();

async function nextSong() {
  play().next();
  await flush();
}

beforeEach(() => {
  store.saved.length = 0;
  usePlayer.setState({ ...initial, shuffleCycles: {}, queue: [], contextInfo: null }, true);
  useLibrary.setState({
    tracks: Object.fromEntries(
      ids(30).map((id) => [id, { id, kind: 'song', locations: {} } as unknown as LocalTrack]),
    ),
    order: [],
  });
});
afterEach(() => vi.restoreAllMocks());

describe('shuffle preference', () => {
  it('ON: starts at a random song and plays the whole round without repeats', async () => {
    const all = ids(8);
    usePlayer.setState({ shuffle: true });
    play().playTracks(all, null, { context: ctx });
    await flush();
    const heard = [play().currentId!];
    for (let i = 1; i < 8; i++) {
      await nextSong();
      heard.push(play().currentId!);
    }
    expect([...heard].sort()).toEqual([...all].sort());
    expect(play().contextShuffled).toBe(true);
  });

  it('OFF: plays in order and starts at the pressed song', async () => {
    usePlayer.setState({ shuffle: false });
    play().playTracks(ids(6), 't3', { context: ctx });
    await flush();
    expect(play().currentId).toBe('t3');
    await nextSong();
    expect(play().currentId).toBe('t4');
    expect(play().contextShuffled).toBe(false);
  });

  it('ON with a start song: starts there and shuffles the rest', async () => {
    usePlayer.setState({ shuffle: true });
    play().playTracks(ids(10), 't3', { context: ctx });
    await flush();
    expect(play().currentId).toBe('t3');
    expect([...play().context].sort()).toEqual([...ids(10)].sort());
  });

  it('an explicit shuffle option never changes the preference', async () => {
    usePlayer.setState({ shuffle: true });
    play().playTracks(ids(5), null, { shuffle: false, context: ctx });
    expect(play().shuffle).toBe(true);
    expect(play().context).toEqual(ids(5));
    usePlayer.setState({ shuffle: false });
    play().playTracks(ids(5), null, { shuffle: true, context: ctx });
    expect(play().shuffle).toBe(false);
    expect(play().contextShuffled).toBe(true);
  });

  it('toggleShuffle flips the preference, saves it and reorders what is pending', async () => {
    usePlayer.setState({ shuffle: false });
    play().playTracks(ids(10), 't2', { context: ctx });
    await flush();
    play().toggleShuffle();
    const s = play();
    expect(s.shuffle).toBe(true);
    expect(s.contextShuffled).toBe(true);
    expect(s.context[s.index]).toBe('t2');
    expect(store.saved).toContainEqual(['shuffle', true]);
    play().toggleShuffle();
    expect(play().context).toEqual(ids(10));
    expect(play().currentId).toBe('t2');
    expect(store.saved).toContainEqual(['shuffle', false]);
  });

  it('toggleShuffle is saved in radio and idle modes too', () => {
    usePlayer.setState({ mode: 'radio', shuffle: false });
    play().toggleShuffle();
    usePlayer.setState({ mode: 'idle' });
    play().toggleShuffle();
    expect(store.saved.filter(([k]) => k === 'shuffle')).toEqual([
      ['shuffle', true],
      ['shuffle', false],
    ]);
  });

  it('fixedOrder lists change the preference but are not reordered', async () => {
    play().playTracks(ids(6), 't1', { shuffle: false, context: { ...ctx, fixedOrder: true } });
    await flush();
    play().toggleShuffle();
    expect(play().shuffle).toBe(true);
    expect(play().context).toEqual(ids(6));
    expect(play().contextShuffled).toBe(false);
  });

  it('fixedOrder lists ignore the preference when starting', async () => {
    usePlayer.setState({ shuffle: true });
    play().playTracks(ids(6), 't1', { context: { ...ctx, fixedOrder: true } });
    await flush();
    expect(play().context).toEqual(ids(6));
  });

  it('previous in shuffle goes back to the song heard before', async () => {
    usePlayer.setState({ shuffle: true });
    play().playTracks(ids(8), null, { context: ctx });
    await flush();
    const first = play().currentId;
    await nextSong();
    play().previous();
    await flush();
    expect(play().currentId).toBe(first);
  });
});

describe('initial value', () => {
  async function freshPlayer() {
    vi.resetModules();
    return (await import('../src/stores/player')).usePlayer;
  }

  it('uses the stored shuffle preference when it exists', async () => {
    store.values = { shuffle: true, 'player-v2': { shuffle: false, context: [], original: [] } };
    const p = await freshPlayer();
    expect(p.getState().shuffle).toBe(true);
    expect(p.getState().contextShuffled).toBe(false);
  });

  it('falls back to the shuffle saved in player-v2', async () => {
    store.values = { 'player-v2': { shuffle: true, context: [], original: [] } };
    const p = await freshPlayer();
    expect(p.getState().shuffle).toBe(true);
    expect(p.getState().contextShuffled).toBe(true);
    store.values = {};
  });
});
