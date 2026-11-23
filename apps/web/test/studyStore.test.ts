import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  prefs: new Map<string, unknown>(),
  volume: 0.8,
  setVolume: vi.fn(),
  pause: vi.fn(),
  playTracks: vi.fn(),
  toast: vi.fn(),
  cancelSleep: vi.fn(),
  consent: 'on',
  library: {
    order: [] as string[],
    tracks: {} as Record<string, unknown>,
    playlists: [] as unknown[],
  },
  lock: {
    pin: vi.fn(async () => undefined),
    unpin: vi.fn(async () => undefined),
    status: vi.fn(async () => ({ pin: 'pinned', lastChimedEndsAt: null })),
    scheduleChime: vi.fn(async () => ({ exact: true })),
    cancelChime: vi.fn(async () => undefined),
    chimeNow: vi.fn(async () => undefined),
  },
  setAmbientLevel: vi.fn(async () => undefined),
  stopAllAmbient: vi.fn(),
}));

vi.mock('../src/stores/player', () => ({
  usePlayer: {
    getState: () => ({
      volume: mocks.volume,
      setVolume: mocks.setVolume,
      pause: mocks.pause,
      playTracks: mocks.playTracks,
    }),
  },
}));
vi.mock('../src/stores/library', () => ({ useLibrary: { getState: () => mocks.library } }));
vi.mock('../src/stores/sleepTimer', () => ({
  useSleepTimer: { getState: () => ({ cancel: mocks.cancelSleep }) },
}));
vi.mock('../src/stores/stats', () => ({
  useStats: { getState: () => ({ consent: mocks.consent }) },
}));
vi.mock('../src/stores/ui', () => ({ toast: mocks.toast }));
vi.mock('../src/i18n', () => ({ t: (key: string) => key }));
vi.mock('../src/lib/storage', () => ({
  loadValue: (key: string, fallback: unknown) => mocks.prefs.get(key) ?? fallback,
  savePref: (key: string, value: unknown) => mocks.prefs.set(key, value),
}));
vi.mock('../src/native/studyLock', () => ({ StudyLock: mocks.lock }));
vi.mock('../src/study/ambient', () => ({
  setAmbientLevel: mocks.setAmbientLevel,
  stopAllAmbient: mocks.stopAllAmbient,
}));

import { memoryStudyRepo, setStudyRepo } from '../src/study/repo';
import { restoreStudySession, useStudy } from '../src/stores/study';

const NOW = 1_000_000;
const MIN = 60_000;

function addTracks(count: number) {
  const order = Array.from({ length: count }, (_, i) => `t${i}`);
  mocks.library.order = order;
  mocks.library.tracks = Object.fromEntries(
    order.map((id) => [
      id,
      { id, title: id, artist: 'x', album: 'y', durationMs: 180_000, kind: 'music' },
    ]),
  );
}

describe('useStudy', () => {
  let repo = memoryStudyRepo();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.prefs.clear();
    mocks.consent = 'on';
    mocks.volume = 0.8;
    Object.values(mocks.lock).forEach((f) => f.mockClear());
    for (const f of [mocks.setVolume, mocks.pause, mocks.playTracks, mocks.toast]) f.mockClear();
    repo = memoryStudyRepo();
    setStudyRepo(repo);
    addTracks(3);
    useStudy.setState({ phase: 'idle', session: null, lastResult: null });
  });

  afterEach(async () => {
    if (useStudy.getState().phase === 'running') {
      const done = useStudy.getState().giveUp();
      await vi.advanceTimersByTimeAsync(10_000);
      await done;
    }
    vi.useRealTimers();
  });

  it('does not start with an empty library and warns', async () => {
    addTracks(0);
    await useStudy.getState().start(25, { kind: 'library' });
    expect(useStudy.getState().phase).toBe('idle');
    expect(mocks.toast).toHaveBeenCalledWith('study.err.noMusic');
    expect(mocks.lock.pin).not.toHaveBeenCalled();
  });

  it('pins, schedules the chime, plays and saves the session', async () => {
    await useStudy.getState().start(25, { kind: 'library' });
    expect(mocks.lock.pin).toHaveBeenCalledTimes(1);
    expect(mocks.lock.scheduleChime).toHaveBeenCalledWith({ endsAt: NOW + 25 * MIN });
    expect(mocks.playTracks).toHaveBeenCalledTimes(1);
    expect(mocks.cancelSleep).toHaveBeenCalled();
    expect(mocks.prefs.get('study-session')).toMatchObject({ plannedMin: 25 });
    expect(useStudy.getState().phase).toBe('running');
  });

  it('fades the volume, chimes once at the end, restores and finishes', async () => {
    await useStudy.getState().start(5, { kind: 'library' });
    await vi.advanceTimersByTimeAsync(5 * MIN - 4000);
    expect(mocks.setVolume).toHaveBeenLastCalledWith(expect.closeTo(0.8 * 0.6, 1));
    await vi.advanceTimersByTimeAsync(4000 + 7000);
    expect(mocks.lock.chimeNow).toHaveBeenCalledTimes(1);
    expect(mocks.setVolume).toHaveBeenLastCalledWith(0.8);
    expect(mocks.pause).toHaveBeenCalledTimes(1);
    expect(mocks.lock.unpin).toHaveBeenCalled();
    expect(useStudy.getState().phase).toBe('done');
    expect(await repo.listBetween(0, NOW * 2)).toMatchObject([{ completed: true, studiedMin: 5 }]);
  });

  it('giveUp saves an incomplete record with the minutes studied', async () => {
    await useStudy.getState().start(25, { kind: 'library' });
    await vi.advanceTimersByTimeAsync(7 * MIN + 5000);
    await useStudy.getState().giveUp();
    expect(mocks.lock.chimeNow).not.toHaveBeenCalled();
    expect(useStudy.getState().phase).toBe('idle');
    expect(useStudy.getState().lastResult).toEqual({ minutes: 7, completed: false });
    expect(await repo.listBetween(0, NOW * 2)).toMatchObject([{ completed: false, studiedMin: 7 }]);
  });

  it('saves nothing without consent', async () => {
    mocks.consent = 'off';
    await useStudy.getState().start(25, { kind: 'library' });
    await useStudy.getState().giveUp();
    expect(await repo.listBetween(0, NOW * 2)).toEqual([]);
  });

  it('restores a finished session as done, without a chime', async () => {
    mocks.prefs.set('study-session', {
      id: 'a',
      startedAt: NOW - 30 * MIN,
      endsAt: NOW - MIN,
      plannedMin: 29,
      source: { kind: 'library' },
    });
    restoreStudySession();
    await vi.advanceTimersByTimeAsync(10);
    expect(useStudy.getState().phase).toBe('done');
    expect(mocks.lock.chimeNow).not.toHaveBeenCalled();
    expect(mocks.lock.unpin).toHaveBeenCalled();
  });

  it('restores a running session', () => {
    mocks.prefs.set('study-session', {
      id: 'b',
      startedAt: NOW - MIN,
      endsAt: NOW + 10 * MIN,
      plannedMin: 11,
      source: { kind: 'library' },
    });
    restoreStudySession();
    expect(useStudy.getState().phase).toBe('running');
    expect(mocks.lock.pin).toHaveBeenCalled();
  });
});
