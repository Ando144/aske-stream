import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const listeners = new Set<(s: unknown, prev: unknown) => void>();
  let state = {
    currentId: 'a' as string | null,
    mode: 'track',
    volume: 0.8,
    repeat: 'off',
    isPlaying: false,
    position: 0,
    duration: 0,
  };
  const prefs = new Map<string, unknown>();
  return {
    listeners,
    prefs,
    getState: () => state,
    setState: (patch: Partial<typeof state>) => {
      const prev = state;
      state = { ...state, ...patch };
      listeners.forEach((l) => l(state, prev));
    },
    pause: vi.fn(),
    setVolume: vi.fn(),
    toast: vi.fn(),
  };
});

vi.mock('../src/stores/player', () => ({
  usePlayer: {
    getState: () => ({ ...mocks.getState(), pause: mocks.pause, setVolume: mocks.setVolume }),
    subscribe: (l: (s: unknown, prev: unknown) => void) => {
      mocks.listeners.add(l);
      return () => mocks.listeners.delete(l);
    },
  },
}));
vi.mock('../src/stores/ui', () => ({ toast: mocks.toast }));
vi.mock('../src/i18n', () => ({
  t: (key: string, vars?: Record<string, unknown>) => `${key}:${JSON.stringify(vars ?? {})}`,
}));
vi.mock('../src/lib/storage', () => ({
  loadValue: (key: string, fallback: unknown) => mocks.prefs.get(key) ?? fallback,
  savePref: (key: string, value: unknown) => mocks.prefs.set(key, value),
}));

import {
  formatSleepTime,
  restoreSleepTimer,
  sleepVolumeFactor,
  useSleepTimer,
} from '../src/stores/sleepTimer';

describe('sleepVolumeFactor', () => {
  it('is 1 before the fade and 0 at or after the end', () => {
    expect(sleepVolumeFactor(0, 60_000)).toBe(1);
    expect(sleepVolumeFactor(60_000, 60_000)).toBe(0);
    expect(sleepVolumeFactor(70_000, 60_000)).toBe(0);
  });

  it('goes down linearly during the last 20 seconds', () => {
    expect(sleepVolumeFactor(50_000, 60_000)).toBeCloseTo(0.5);
    expect(sleepVolumeFactor(40_000, 60_000)).toBe(1);
    expect(sleepVolumeFactor(30_000, 60_000, 10_000)).toBe(1);
  });
});

describe('formatSleepTime', () => {
  const tr = ((key: string, vars?: Record<string, unknown>) => `${vars?.count}${key}`) as never;

  it('uses seconds in the last minute, minutes below an hour, hours and minutes above', () => {
    expect(formatSleepTime(45_000, tr)).toBe('45sleep.seconds');
    expect(formatSleepTime(12 * 60_000, tr)).toBe('12sleep.minutes');
    expect(formatSleepTime(80 * 60_000, tr)).toBe('1sleep.hours 20sleep.minutes');
    expect(formatSleepTime(2 * 3_600_000, tr)).toBe('2sleep.hours');
  });
});

describe('useSleepTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    mocks.prefs.clear();
    mocks.pause.mockClear();
    mocks.setVolume.mockClear();
    mocks.toast.mockClear();
    mocks.setState({
      currentId: 'a',
      mode: 'track',
      volume: 0.8,
      repeat: 'off',
      isPlaying: false,
      position: 0,
      duration: 0,
    });
  });

  afterEach(() => {
    useSleepTimer.getState().cancel();
    vi.useRealTimers();
  });

  it('clamps minutes to 1..480', () => {
    useSleepTimer.getState().start({ minutes: 600 });
    expect(useSleepTimer.getState().endsAt).toBe(1_000_000 + 480 * 60_000);
    useSleepTimer.getState().start({ minutes: 0 });
    expect(useSleepTimer.getState().endsAt).toBe(1_000_000 + 60_000);
  });

  it('fades, pauses at the end and restores the volume', () => {
    useSleepTimer.getState().start({ minutes: 1 });
    vi.advanceTimersByTime(30_000);
    expect(mocks.setVolume).not.toHaveBeenCalled();
    vi.advanceTimersByTime(20_000);
    expect(mocks.setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.4, 1));
    vi.advanceTimersByTime(10_000);
    expect(mocks.pause).toHaveBeenCalledTimes(1);
    expect(mocks.setVolume).toHaveBeenLastCalledWith(0.8);
    expect(useSleepTimer.getState().endsAt).toBeNull();
    expect(mocks.toast).toHaveBeenLastCalledWith(expect.stringContaining('sleep.stopped'));
    expect(mocks.prefs.get('sleep-timer')).toBeNull();
  });

  it('cancel stops the timer and restores the volume without pausing', () => {
    useSleepTimer.getState().start({ minutes: 1 });
    vi.advanceTimersByTime(50_000);
    useSleepTimer.getState().cancel();
    expect(mocks.setVolume).toHaveBeenLastCalledWith(0.8);
    vi.advanceTimersByTime(60_000);
    expect(mocks.pause).not.toHaveBeenCalled();
    expect(useSleepTimer.getState().endsAt).toBeNull();
  });

  it('endOfTrack is armed without pausing on unrelated changes', () => {
    useSleepTimer.getState().start('endOfTrack');
    expect(useSleepTimer.getState().endOfTrack).toBe(true);
    expect(useSleepTimer.getState().endsAt).toBeNull();
    mocks.setState({ volume: 0.7 });
    expect(mocks.pause).not.toHaveBeenCalled();
  });

  it('endOfTrack waits for the next song to start playing before pausing', () => {
    mocks.setState({ isPlaying: true, position: 100, duration: 100 });
    useSleepTimer.getState().start('endOfTrack');
    mocks.setState({ isPlaying: false });
    mocks.setState({ currentId: 'b' });
    expect(mocks.pause).not.toHaveBeenCalled();
    mocks.setState({ position: 0, duration: 0 });
    expect(mocks.pause).not.toHaveBeenCalled();
    mocks.setState({ isPlaying: true });
    expect(mocks.pause).toHaveBeenCalledTimes(1);
    expect(useSleepTimer.getState().endOfTrack).toBe(false);
  });

  it('endOfTrack finishes with repeat one when the song restarts', () => {
    mocks.setState({ repeat: 'one', isPlaying: true, position: 99, duration: 100 });
    useSleepTimer.getState().start('endOfTrack');
    mocks.setState({ position: 0 });
    expect(mocks.pause).toHaveBeenCalledTimes(1);
    expect(useSleepTimer.getState().endOfTrack).toBe(false);
  });

  it('endOfTrack finishes at the end of the queue without repeat', () => {
    mocks.setState({ repeat: 'off', isPlaying: false, position: 99, duration: 100 });
    useSleepTimer.getState().start('endOfTrack');
    mocks.setState({ position: 0 });
    expect(mocks.pause).toHaveBeenCalledTimes(1);
    expect(useSleepTimer.getState().endOfTrack).toBe(false);
  });

  it('endOfTrack pauses when the queue runs out (no current song)', () => {
    useSleepTimer.getState().start('endOfTrack');
    mocks.setState({ currentId: null, mode: 'idle' });
    expect(mocks.pause).toHaveBeenCalledTimes(1);
  });

  it('persists endsAt and restores a pending timer after a reload', () => {
    useSleepTimer.getState().start({ minutes: 3 });
    const saved = mocks.prefs.get('sleep-timer');
    expect(saved).toEqual({ endsAt: 1_000_000 + 180_000 });
    useSleepTimer.getState().cancel();
    mocks.prefs.set('sleep-timer', saved);
    restoreSleepTimer();
    expect(useSleepTimer.getState().endsAt).toBe(1_000_000 + 180_000);
  });

  it('ignores a persisted timer that already expired', () => {
    mocks.prefs.set('sleep-timer', { endsAt: 999_000 });
    restoreSleepTimer();
    expect(useSleepTimer.getState().endsAt).toBeNull();
    expect(mocks.pause).not.toHaveBeenCalled();
  });
});
