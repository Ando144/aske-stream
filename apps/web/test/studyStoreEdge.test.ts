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
    scheduleChime: vi.fn(async (_o: unknown) => ({ exact: true })),
    cancelChime: vi.fn(async () => undefined),
    chimeNow: vi.fn(async (_o: unknown) => undefined),
  },
  setAmbientLevel: vi.fn(async (_id: string, _level: number) => undefined),
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

import { memoryStudyRepo, setStudyRepo, type StudyRepo } from '../src/study/repo';
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

function saved(over: Record<string, unknown> = {}) {
  return {
    id: 's1',
    startedAt: NOW - 10 * MIN,
    endsAt: NOW + 10 * MIN,
    plannedMin: 20,
    source: { kind: 'library' },
    ...over,
  };
}

describe('useStudy edge cases', () => {
  let repo: StudyRepo = memoryStudyRepo();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    mocks.prefs.clear();
    mocks.consent = 'on';
    mocks.volume = 0.8;
    for (const f of Object.values(mocks.lock)) f.mockClear();
    for (const f of [mocks.setVolume, mocks.pause, mocks.playTracks, mocks.toast]) f.mockClear();
    mocks.setAmbientLevel.mockClear();
    mocks.stopAllAmbient.mockClear();
    repo = memoryStudyRepo();
    setStudyRepo(repo);
    addTracks(3);
    useStudy.setState({ phase: 'idle', session: null, lastResult: null, ambient: {} });
  });

  afterEach(async () => {
    if (useStudy.getState().phase === 'running') {
      const done = useStudy.getState().giveUp();
      await vi.advanceTimersByTimeAsync(10_000);
      await done;
    }
    vi.useRealTimers();
  });

  describe('restore after a restart', () => {
    it('ignores corrupt saved data and stays idle', () => {
      mocks.prefs.set('study-session', { id: 'x', startedAt: 'now' });
      restoreStudySession();
      expect(useStudy.getState().phase).toBe('idle');
      expect(mocks.lock.pin).not.toHaveBeenCalled();
    });

    it('does nothing when nothing was saved', () => {
      restoreStudySession();
      expect(useStudy.getState().phase).toBe('idle');
      expect(mocks.lock.unpin).not.toHaveBeenCalled();
    });

    it('ended session without consent: shows done, saves nothing and still unpins', async () => {
      mocks.consent = 'off';
      mocks.prefs.set('study-session', saved({ startedAt: NOW - 30 * MIN, endsAt: NOW - MIN }));
      restoreStudySession();
      await vi.advanceTimersByTimeAsync(10);
      expect(useStudy.getState().phase).toBe('done');
      expect(await repo.listBetween(0, NOW * 2)).toEqual([]);
      expect(mocks.lock.unpin).toHaveBeenCalled();
      expect(mocks.prefs.get('study-session')).toBeNull();
    });

    it('ended session with consent: saves a completed record capped at the planned time', async () => {
      mocks.prefs.set(
        'study-session',
        saved({ startedAt: NOW - 600 * MIN, endsAt: NOW - 580 * MIN, plannedMin: 20 }),
      );
      restoreStudySession();
      await vi.advanceTimersByTimeAsync(10);
      const [record] = await repo.listBetween(-1e9, NOW * 2);
      expect(record).toMatchObject({ completed: true, studiedMin: 20, endedAt: NOW - 580 * MIN });
      expect(useStudy.getState().lastResult).toEqual({ minutes: 20, completed: true });
    });

    it('ended session still unpins when the repo fails', async () => {
      setStudyRepo({
        put: async () => {
          throw new Error('disk full');
        },
        listBetween: async () => [],
        clear: async () => undefined,
      });
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.prefs.set('study-session', saved({ startedAt: NOW - 30 * MIN, endsAt: NOW - MIN }));
      restoreStudySession();
      await vi.advanceTimersByTimeAsync(10);
      expect(mocks.toast).toHaveBeenCalledWith('study.err.save');
      expect(mocks.lock.unpin).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('resumed session re-applies the saved ambient levels and finishes on time', async () => {
      useStudy.setState({ ambient: { brown: 0.5 } });
      mocks.prefs.set('study-session', saved({ endsAt: NOW + 2000, plannedMin: 11 }));
      restoreStudySession();
      expect(mocks.setAmbientLevel).toHaveBeenCalledWith('brown', 0.5);
      await vi.advanceTimersByTimeAsync(2000 + 7000);
      expect(useStudy.getState().phase).toBe('done');
      expect(mocks.lock.chimeNow).toHaveBeenCalledTimes(1);
    });

    it('resuming twice does not duplicate the end of session', async () => {
      mocks.prefs.set('study-session', saved({ endsAt: NOW + 2000, plannedMin: 11 }));
      restoreStudySession();
      restoreStudySession();
      await vi.advanceTimersByTimeAsync(2000 + 7000);
      expect(mocks.lock.chimeNow).toHaveBeenCalledTimes(1);
      expect(await repo.listBetween(0, NOW * 2)).toHaveLength(1);
    });
  });

  describe('end of session', () => {
    it('without stats consent still chimes, unpins and finishes, saving nothing', async () => {
      mocks.consent = 'off';
      await useStudy.getState().start(5, { kind: 'library' });
      await vi.advanceTimersByTimeAsync(5 * MIN + 7000);
      expect(mocks.lock.chimeNow).toHaveBeenCalledTimes(1);
      expect(mocks.lock.unpin).toHaveBeenCalled();
      expect(useStudy.getState().phase).toBe('done');
      expect(await repo.listBetween(0, NOW * 2)).toEqual([]);
    });

    it('a second giveUp while the chime plays does not chime or save twice', async () => {
      await useStudy.getState().start(5, { kind: 'library' });
      await vi.advanceTimersByTimeAsync(5 * MIN + 100);
      await useStudy.getState().giveUp();
      await vi.advanceTimersByTimeAsync(7000);
      expect(mocks.lock.chimeNow).toHaveBeenCalledTimes(1);
      expect(await repo.listBetween(0, NOW * 2)).toHaveLength(1);
      expect(useStudy.getState().phase).toBe('done');
    });

    it('still finishes when the native chime fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.lock.chimeNow.mockRejectedValueOnce(new Error('no audio'));
      await useStudy.getState().start(5, { kind: 'library' });
      await vi.advanceTimersByTimeAsync(5 * MIN + 7000);
      expect(useStudy.getState().phase).toBe('done');
      expect(mocks.pause).toHaveBeenCalled();
      vi.restoreAllMocks();
    });

    it('a late tick (app was suspended) records at most the planned minutes', async () => {
      await useStudy.getState().start(5, { kind: 'library' });
      vi.setSystemTime(NOW + 60 * MIN);
      await vi.advanceTimersByTimeAsync(1000 + 7000);
      const [record] = await repo.listBetween(0, NOW * 2);
      expect(record).toMatchObject({ studiedMin: 5, endedAt: NOW + 5 * MIN, completed: true });
    });

    it('giveUp in the fade restores the original volume and stops the ambient sound', async () => {
      await useStudy.getState().start(5, { kind: 'library' });
      await vi.advanceTimersByTimeAsync(5 * MIN - 4000);
      await useStudy.getState().giveUp();
      expect(mocks.setVolume).toHaveBeenLastCalledWith(0.8);
      expect(mocks.stopAllAmbient).toHaveBeenCalled();
    });

    it('giveUp when idle does nothing', async () => {
      await useStudy.getState().giveUp();
      expect(mocks.lock.unpin).not.toHaveBeenCalled();
      expect(mocks.toast).not.toHaveBeenCalled();
    });
  });

  describe('start', () => {
    it('a second start while running is ignored', async () => {
      await useStudy.getState().start(25, { kind: 'library' });
      await useStudy.getState().start(45, { kind: 'calm' });
      expect(mocks.playTracks).toHaveBeenCalledTimes(1);
      expect(useStudy.getState().session?.plannedMin).toBe(25);
    });

    it('clamps absurd minutes and remembers the choice', async () => {
      await useStudy.getState().start(100000, { kind: 'library' });
      expect(useStudy.getState().session?.plannedMin).toBe(240);
      expect(mocks.prefs.get('study-last')).toEqual({ minutes: 240, source: { kind: 'library' } });
    });

    it('can start again after a finished session was dismissed', async () => {
      await useStudy.getState().start(5, { kind: 'library' });
      await vi.advanceTimersByTimeAsync(5 * MIN + 7000);
      useStudy.getState().dismissDone();
      expect(useStudy.getState().phase).toBe('idle');
      await useStudy.getState().start(5, { kind: 'library' });
      expect(useStudy.getState().phase).toBe('running');
      expect(useStudy.getState().lastResult).toBeNull();
    });

    it('giveUp while start is still scheduling the chime must not pin afterwards', async () => {
      let release: () => void = () => undefined;
      mocks.lock.scheduleChime.mockImplementationOnce(
        () => new Promise((resolve) => (release = () => resolve({ exact: true }))),
      );
      const starting = useStudy.getState().start(5, { kind: 'library' });
      await useStudy.getState().giveUp();
      release();
      await starting;
      const unpinOrder = mocks.lock.unpin.mock.invocationCallOrder.at(-1) ?? 0;
      const pinOrder = mocks.lock.pin.mock.invocationCallOrder.at(-1) ?? 0;
      expect(pinOrder).toBeLessThan(unpinOrder);
    });
  });

  describe('changeSource during a session', () => {
    it('switches queue and persists the new source without touching the end time', async () => {
      await useStudy.getState().start(25, { kind: 'library' });
      const endsAt = useStudy.getState().session!.endsAt;
      useStudy.getState().changeSource({ kind: 'calm' });
      const { session, lastChoice } = useStudy.getState();
      expect(session).toMatchObject({ endsAt, source: { kind: 'calm' } });
      expect(lastChoice).toEqual({ minutes: 25, source: { kind: 'calm' } });
      expect(mocks.playTracks).toHaveBeenCalledTimes(2);
      expect(mocks.prefs.get('study-session')).toMatchObject({ source: { kind: 'calm' } });
      expect(useStudy.getState().fellBack).toBe(true);
    });

    it('with no playable tracks keeps the current source and warns', async () => {
      await useStudy.getState().start(25, { kind: 'library' });
      addTracks(0);
      useStudy.getState().changeSource({ kind: 'calm' });
      expect(mocks.toast).toHaveBeenCalledWith('study.err.noMusic');
      expect(useStudy.getState().session?.source).toEqual({ kind: 'library' });
      expect(mocks.playTracks).toHaveBeenCalledTimes(1);
    });

    it('is ignored when there is no session', () => {
      useStudy.getState().changeSource({ kind: 'calm' });
      expect(mocks.playTracks).not.toHaveBeenCalled();
    });

    it('a restored session can change source and is saved with it', () => {
      mocks.prefs.set('study-session', saved());
      restoreStudySession();
      useStudy.getState().changeSource({ kind: 'calm' });
      expect(mocks.prefs.get('study-session')).toMatchObject({
        id: 's1',
        source: { kind: 'calm' },
      });
    });
  });

  describe('ambient levels', () => {
    it('persists and applies a level', () => {
      useStudy.getState().setAmbient('rain', 0.4);
      expect(mocks.prefs.get('study-ambient')).toEqual({ rain: 0.4 });
      expect(mocks.setAmbientLevel).toHaveBeenCalledWith('rain', 0.4);
    });

    it('a failing ambient sound does not break the session', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mocks.setAmbientLevel.mockRejectedValueOnce(new Error('blocked'));
      useStudy.getState().setAmbient('brown', 0.3);
      await vi.advanceTimersByTimeAsync(10);
      expect(useStudy.getState().ambient).toEqual({ brown: 0.3 });
      vi.restoreAllMocks();
    });
  });
});
