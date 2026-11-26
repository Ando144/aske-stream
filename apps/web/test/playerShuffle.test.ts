import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// The player store builds a real <audio> element at import time; give it a tiny fake.
vi.hoisted(() => {
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
  g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  g.URL = Object.assign(URL, { revokeObjectURL() {} });
});

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
  return {
    useLibrary: create(() => ({
      tracks: {} as Record<string, { id: string; kind?: string; locations: object }>,
      order: [] as string[],
    })),
  };
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
  return {
    resumePosition: () => 0,
    usePodcasts: create(() => ({ rate: 1, setRate() {} })),
  };
});
vi.mock('../src/stores/prefs', async () => {
  const { create } = await import('zustand');
  return { usePrefs: create(() => ({ dataSaver: false })) };
});
vi.mock('../src/stores/radio', () => ({ catalog: { click: async () => {} } }));
vi.mock('../src/stores/ui', () => ({ toast() {} }));
vi.mock('../src/native/platform', () => ({ isNative: false }));
vi.mock('../src/lib/power', () => ({ mayRotateOfflineNow: () => false }));

import { MAX_REMEMBERED_CYCLES } from '../src/player/shuffleCycle';
import { audio } from '../src/player/runtime';
import type { LocalTrack } from '../src/storage/types';
import { useLibrary } from '../src/stores/library';
import { usePlayer, type PlayContext } from '../src/stores/player';
import { usePrefs } from '../src/stores/prefs';

type Player = typeof usePlayer;
let player: Player;
const ALL: PlayContext = { label: 'Todo', live: 'library', cycleKey: 'library' };

const ids = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);
const fakeTrack = (id: string, kind = 'song') =>
  ({ id, kind, locations: {} }) as unknown as LocalTrack;
const flush = () => new Promise((r) => setTimeout(r, 0));
const setLibrary = (list: string[], onDevice: string[] = []) =>
  useLibrary.setState({
    tracks: Object.fromEntries(
      list.map((id) => {
        const locations = onDevice.includes(id) ? { device: true as const } : {};
        return [id, { ...fakeTrack(id), locations }];
      }),
    ),
    order: [],
  });

/** Presses next and waits for the async song load to finish. */
async function nextSong() {
  usePlayer.getState().next();
  await flush();
}

/** Plays a whole round (everything after the opening song) and returns the order heard. */
async function playRound(total: number): Promise<string[]> {
  const heard = [usePlayer.getState().currentId!];
  for (let i = 1; i < total; i++) {
    await nextSong();
    heard.push(usePlayer.getState().currentId!);
  }
  return heard;
}

const baseline = () => usePlayer.getState();
let initial: ReturnType<typeof baseline>;

beforeAll(() => {
  player = usePlayer;
  initial = usePlayer.getState();
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(1_000_000);
  usePlayer.setState({ ...initial, shuffleCycles: {}, queue: [], contextInfo: null }, true);
  usePrefs.setState({ dataSaver: false });
  setLibrary([...ids(40), 'q1']);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Aleatorio remembers what was heard per list', () => {
  it('records each song heard in the list cycle', async () => {
    usePlayer.getState().playTracks(ids(5), null, { shuffle: true, context: ALL });
    await flush();
    await nextSong();
    const s = usePlayer.getState();
    const cycle = s.shuffleCycles[ALL.cycleKey!]!;
    expect(cycle.played).toHaveLength(2);
    expect(cycle.played).toContain(s.currentId);
  });

  it('does not record anything when shuffle is off', async () => {
    usePlayer.getState().playTracks(ids(5), null, { shuffle: false, context: ALL });
    await flush();
    expect(usePlayer.getState().shuffleCycles).toEqual({});
  });

  it('keeps separate memory for separate lists', async () => {
    usePlayer
      .getState()
      .playTracks(ids(4), null, { shuffle: true, context: { label: 'A', path: 'a' } });
    await flush();
    usePlayer
      .getState()
      .playTracks(ids(4), null, { shuffle: true, context: { label: 'B', path: 'b' } });
    await flush();
    const cycles = usePlayer.getState().shuffleCycles;
    expect(Object.keys(cycles).sort()).toEqual(['a', 'b']);
    expect(cycles.a!.played).toHaveLength(1);
  });

  it('remembers at most 20 lists', async () => {
    for (let i = 0; i < MAX_REMEMBERED_CYCLES + 3; i++) {
      vi.setSystemTime(1_000_000 + i * 1000);
      usePlayer.getState().playTracks(ids(4), null, {
        shuffle: true,
        context: { label: `L${i}`, path: `p${i}` },
      });
      await flush();
    }
    const keys = Object.keys(usePlayer.getState().shuffleCycles);
    expect(keys).toHaveLength(MAX_REMEMBERED_CYCLES);
    expect(keys).not.toContain('p0');
    expect(keys).toContain(`p${MAX_REMEMBERED_CYCLES + 2}`);
  });

  it('songs played from the manual queue do not count as heard', async () => {
    usePlayer.getState().playTracks(ids(5), null, { shuffle: true, context: ALL });
    await flush();
    usePlayer.getState().addToQueue(['q1']);
    await nextSong();
    expect(usePlayer.getState().currentId).toBe('q1');
    expect(usePlayer.getState().shuffleCycles[ALL.cycleKey!]!.played).not.toContain('q1');
  });
});

describe('unheard songs play first', () => {
  it('pressing Aleatorio again plays the songs not heard yet before the heard ones', async () => {
    const all = ids(10);
    usePlayer.getState().playTracks(all, null, { shuffle: true, context: ALL });
    await flush();
    const heard = new Set(usePlayer.getState().shuffleCycles[ALL.cycleKey!]!.played);
    await nextSong();
    await nextSong();
    for (const id of usePlayer.getState().shuffleCycles[ALL.cycleKey!]!.played) heard.add(id);
    expect(heard.size).toBe(3);

    usePlayer.getState().playTracks(all, null, { shuffle: true, context: ALL });
    await flush();
    const order = usePlayer.getState().context;
    const firstHeard = order.findIndex((id) => heard.has(id));
    expect(firstHeard).toBeGreaterThanOrEqual(7);
  });

  it('turning shuffle on keeps the current song first and unheard ones next', async () => {
    const all = ids(8);
    usePlayer.getState().playTracks(all, 't3', { shuffle: false, context: ALL });
    await flush();
    usePlayer.getState().toggleShuffle();
    const s = usePlayer.getState();
    expect(s.shuffle).toBe(true);
    expect(s.context[s.index]).toBe('t3');
    expect([...s.context].sort()).toEqual([...all].sort());
  });

  it('turning shuffle off restores the original order at the current song', async () => {
    const all = ids(6);
    usePlayer.setState({ shuffle: true });
    usePlayer.getState().playTracks(all, null, { context: ALL });
    await flush();
    const current = usePlayer.getState().currentId!;
    usePlayer.getState().toggleShuffle();
    const s = usePlayer.getState();
    expect(s.context).toEqual(all);
    expect(s.context[s.index]).toBe(current);
  });
});

describe('every song plays once before repeating', () => {
  it('plays all songs exactly once per round with repeat all, over three rounds', async () => {
    const all = ids(6);
    usePlayer.getState().playTracks(all, null, { shuffle: true, context: ALL });
    usePlayer.getState().cycleRepeat(); // off -> all
    await flush();
    const heard = await playRound(18);
    for (let round = 0; round < 3; round++) {
      expect(heard.slice(round * 6, round * 6 + 6).sort()).toEqual([...all].sort());
    }
  });

  it('the first song of a new round is never the last song of the previous one', async () => {
    const all = ids(5);
    for (let attempt = 0; attempt < 15; attempt++) {
      usePlayer.setState({ shuffleCycles: {} });
      usePlayer.getState().playTracks(all, null, { shuffle: true, context: ALL });
      if (usePlayer.getState().repeat !== 'all') usePlayer.getState().cycleRepeat();
      await flush();
      const heard = await playRound(5);
      const last = heard[4];
      await nextSong();
      expect(usePlayer.getState().index).toBe(0);
      expect(usePlayer.getState().currentId).not.toBe(last);
    }
  });

  it('after a full round the cycle memory is cleared', async () => {
    setLibrary(ids(4));
    usePlayer.getState().playTracks(ids(4), null, { shuffle: true, context: ALL });
    await flush();
    await playRound(4);
    expect(usePlayer.getState().shuffleCycles[ALL.cycleKey!]!.played).toEqual([]);
  });
});

describe('songs added later join the live library list', () => {
  function addSongs(newIds: string[]) {
    const lib = useLibrary.getState();
    const tracks = { ...lib.tracks };
    for (const id of newIds) tracks[id] = fakeTrack(id);
    useLibrary.setState({ tracks, order: [...newIds, ...lib.order] });
  }

  it('inserts new songs after the current one in shuffle and adds them to original', async () => {
    const all = ids(6);
    addSongs(all);
    usePlayer.getState().playTracks(all, null, { shuffle: true, context: ALL });
    await flush();
    const before = usePlayer.getState();
    addSongs(['n1', 'n2']);
    const s = usePlayer.getState();
    expect(s.original).toEqual([...all, 'n1', 'n2']);
    expect(s.context).toHaveLength(8);
    expect(s.context.slice(0, before.index + 1)).toEqual(before.context.slice(0, before.index + 1));
    expect(s.context.indexOf('n1')).toBeGreaterThan(before.index);
    expect(s.context.indexOf('n2')).toBeGreaterThan(before.index);
  });

  it('new songs land at varied positions, not always at the end', async () => {
    const all = ids(30);
    addSongs(all);
    const spots = new Set<number>();
    for (let i = 0; i < 12; i++) {
      usePlayer.getState().playTracks(all, null, { shuffle: true, context: ALL });
      await flush();
      useLibrary.setState({
        tracks: Object.fromEntries(all.map((id) => [id, fakeTrack(id)])),
        order: [...all],
      });
      addSongs([`n${i}`]);
      spots.add(usePlayer.getState().context.indexOf(`n${i}`));
    }
    expect(spots.size).toBeGreaterThan(2);
  });

  it('appends at the end when shuffle is off', async () => {
    const all = ids(4);
    addSongs(all);
    usePlayer.getState().playTracks(all, null, { shuffle: false, context: ALL });
    await flush();
    addSongs(['n1']);
    expect(usePlayer.getState().context).toEqual([...all, 'n1']);
  });

  it('ignores podcasts and lists that are not the live library', async () => {
    const all = ids(4);
    addSongs(all);
    usePlayer.getState().playTracks(all, null, { shuffle: true, context: ALL });
    await flush();
    const lib = useLibrary.getState();
    useLibrary.setState({
      tracks: { ...lib.tracks, pod: fakeTrack('pod', 'podcast') },
      order: ['pod', ...lib.order],
    });
    expect(usePlayer.getState().context).not.toContain('pod');

    usePlayer
      .getState()
      .playTracks(all, null, { shuffle: true, context: { label: 'Mine', path: 'p' } });
    await flush();
    addSongs(['n9']);
    expect(usePlayer.getState().context).not.toContain('n9');
  });
});

describe('fixed order round', () => {
  const state = () => usePlayer.getState();
  const heard = () => state().shuffleCycles.library!.played;
  const upcoming = () => state().context.slice(state().index + 1);

  async function playShuffled(list: string[], startId: string | null = null) {
    state().playTracks(list, startId, { shuffle: true, context: ALL });
    await flush();
  }

  it('Play, three songs, a podcast, Play: same order without the three heard', async () => {
    const all = ids(10);
    setLibrary(all);
    useLibrary.setState({
      tracks: { ...useLibrary.getState().tracks, pod: fakeTrack('pod', 'podcast') },
    });
    await playShuffled(all);
    const order = [...state().context];
    await nextSong();
    await nextSong();
    state().playTracks(['pod'], 'pod', { context: { label: 'P', fixedOrder: true } });
    await flush();
    await playShuffled(all);
    expect(state().context).toEqual([...order.slice(3), ...order.slice(0, 3)]);
  });

  it('a tapped song goes first and the round follows', async () => {
    await playShuffled(ids(10));
    const order = [...state().context];
    const tapped = order[6]!;
    await playShuffled(ids(10), tapped);
    const unheard = order.slice(1).filter((id) => id !== tapped);
    expect(state().context).toEqual([tapped, ...unheard, order[0]]);
  });

  it('turning shuffle off and on does not change the order', async () => {
    usePlayer.setState({ shuffle: true });
    await playShuffled(ids(12));
    await nextSong();
    await nextSong();
    const before = upcoming();
    const heardBefore = heard();
    state().toggleShuffle();
    state().toggleShuffle();
    expect(upcoming().slice(0, before.length)).toEqual(before);
    expect(heard()).toEqual(heardBefore);
  });

  it('songs heard with shuffle off do not count', async () => {
    usePlayer.setState({ shuffle: true });
    await playShuffled(ids(12));
    state().toggleShuffle();
    await nextSong();
    expect(heard()).toHaveLength(1);
  });

  it('reshuffle reorders what is left and leaves the heard songs at the end', async () => {
    await playShuffled(ids(30));
    await nextSong();
    await nextSong();
    const current = state().currentId!;
    const before = upcoming();
    const heardBefore = heard();
    state().reshuffle();
    const after = upcoming();
    expect(state().context[state().index]).toBe(current);
    expect(after).not.toEqual(before);
    expect(after.slice(-2).sort()).toEqual(heardBefore.filter((id) => id !== current).sort());
    expect(heard()).toEqual(heardBefore);
  });

  it('reshuffle leaves a list that is not shuffled untouched', async () => {
    state().playTracks(ids(6), 't2', { shuffle: false, context: ALL });
    await flush();
    state().reshuffle();
    expect(state().context).toEqual(ids(6));
  });

  it('a saved round without seed keeps working', async () => {
    usePlayer.setState({
      shuffleCycles: { library: { key: 'library', played: ['t0', 't1'], usedAt: 1 } },
    });
    await playShuffled(ids(6));
    expect(state().context.slice(-2).sort()).toEqual(['t0', 't1']);
    expect(state().shuffleCycles.library!.seed).toBeDefined();
  });

  it('a filtered list shares the round and does not end it', async () => {
    await playShuffled(ids(40));
    const order = [...state().context];
    const subset = [order[0]!, order[5]!, order[9]!];
    await playShuffled(subset);
    expect(state().context).toEqual([order[5], order[9], order[0]]);
    await nextSong();
    expect(heard()).toHaveLength(3);
  });

  it('data saver keeps the round and puts offline unheard songs first', async () => {
    vi.stubGlobal('navigator', { onLine: true });
    await playShuffled(ids(10));
    const order = [...state().context];
    const offline = [order[0]!, order[4]!, order[7]!];
    setLibrary(ids(10), offline);
    usePrefs.setState({ dataSaver: true });
    await playShuffled(ids(10));
    const streamed = order.slice(1).filter((id) => !offline.includes(id));
    expect(state().context).toEqual([order[4], order[7], ...streamed, order[0]]);
  });

  it('previous with skipRestart goes back after the first seconds', async () => {
    await playShuffled(ids(6));
    const first = state().currentId;
    await nextSong();
    const element = audio as unknown as { currentTime: number };
    element.currentTime = 10;
    state().previous();
    expect(state().currentId).not.toBe(first);
    element.currentTime = 10;
    state().previous({ skipRestart: true });
    await flush();
    expect(state().currentId).toBe(first);
  });
});
