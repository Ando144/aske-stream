import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => {
  const shared = {
    playCalls: 0,
    pending: [] as Array<(src: string) => void>,
    deferred: false,
    reload: () => {},
  };
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
      shared.playCalls++;
      return Promise.resolve();
    }
  }
  const g = globalThis as Record<string, unknown>;
  g.Audio = FakeAudio;
  g.window = { addEventListener() {} };
  g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  g.URL = Object.assign(URL, { revokeObjectURL() {} });
  return shared;
});

vi.mock('../src/storage/media', () => ({
  resolveAudio: () =>
    h.deferred
      ? new Promise<string>((resolve) => h.pending.push(resolve))
      : Promise.resolve('https://x/audio'),
}));
vi.mock('../src/player/stallRecovery', () => ({
  attachStallRecovery: (_audio: unknown, deps: { reloadCurrent: () => void }) => {
    h.reload = deps.reloadCurrent;
    return { retryNow() {} };
  },
}));
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
      tracks: { a: { id: 'a', kind: 'song', locations: {} } } as Record<string, object>,
      order: ['a'],
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

import { rt } from '../src/player/runtime';
import { usePlayer } from '../src/stores/player';

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  h.deferred = false;
  h.pending.length = 0;
  usePlayer.setState({ mode: 'idle', isPlaying: false, currentId: null, queue: [] });
  rt.userPauseSeq = 0;
});

describe('pause while a song is still loading', () => {
  it('reloadCurrent does not resume if the user paused before the source resolved', async () => {
    usePlayer.setState({ mode: 'track', currentId: 'a', isPlaying: true });
    h.deferred = true;
    h.playCalls = 0;
    h.reload();
    usePlayer.getState().pause();
    h.pending.forEach((resolve) => resolve('https://x/audio'));
    await flush();
    expect(h.playCalls).toBe(0);
  });

  it('reloadCurrent resumes a playing song when the user did not pause', async () => {
    usePlayer.setState({ mode: 'track', currentId: 'a', isPlaying: true });
    h.deferred = true;
    h.playCalls = 0;
    h.reload();
    h.pending.forEach((resolve) => resolve('https://x/audio'));
    await flush();
    expect(h.playCalls).toBe(1);
  });

  it('a new song loaded while the user pauses stays silent with isPlaying false', async () => {
    h.deferred = true;
    h.playCalls = 0;
    usePlayer.getState().playTracks(['a']);
    usePlayer.getState().pause();
    h.pending.forEach((resolve) => resolve('https://x/audio'));
    await flush();
    expect(h.playCalls).toBe(0);
    expect(usePlayer.getState().isPlaying).toBe(false);
  });

  it('without a pause, a song load starts playing', async () => {
    h.playCalls = 0;
    usePlayer.getState().playTracks(['a']);
    await flush();
    expect(h.playCalls).toBe(1);
  });
});
