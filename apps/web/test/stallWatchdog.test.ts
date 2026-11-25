import { describe, expect, it, vi } from 'vitest';
import {
  STALL_TIMING,
  createStallWatchdog,
  decideStall,
  forceAttempt,
  initialStallState,
  isMidSongNetworkError,
  type StallSample,
  type StallState,
} from '../src/player/stallWatchdog';

function sample(over: Partial<StallSample> = {}): StallSample {
  return {
    now: 0,
    active: true,
    trackId: 't1',
    currentTime: 10,
    readyState: 4,
    online: true,
    ...over,
  };
}

function startState(now = 0, time = 10): StallState {
  return { ...initialStallState(now), trackId: 't1', lastTime: time };
}

/** Runs decideStall at the given time offsets with a frozen currentTime. */
function stuckAt(state: StallState, now: number, over: Partial<StallSample> = {}) {
  return decideStall(state, sample({ now, ...over }));
}

describe('decideStall', () => {
  it('does nothing while the playhead advances', () => {
    const r = stuckAt(startState(), 1000, { currentTime: 11 });
    expect(r.action).toBe('none');
    expect(r.state.lastTime).toBe(11);
    expect(r.state.lastProgressAt).toBe(1000);
    expect(r.state.stalledSince).toBeNull();
  });

  it('is not stalled at 2.9 s without progress', () => {
    const r = stuckAt(startState(), 2900);
    expect(r.action).toBe('none');
    expect(r.state.stalledSince).toBeNull();
  });

  it('marks the stall at 3 s without acting', () => {
    const r = stuckAt(startState(), 3000);
    expect(r.action).toBe('none');
    expect(r.state.stalledSince).toBe(3000);
  });

  it('nudges at 6 s when metadata is loaded', () => {
    const r = stuckAt(startState(), 6000, { readyState: 1 });
    expect(r.action).toBe('nudge');
    expect(r.state.attempts).toBe(1);
    expect(r.state.nextAttemptAt).toBe(6000 + STALL_TIMING.backoffMs[0]);
  });

  it('reloads at 6 s when nothing is loaded', () => {
    const r = stuckAt(startState(), 6000, { readyState: 0 });
    expect(r.action).toBe('reload');
    expect(r.state.attempts).toBe(1);
  });

  it('waits 5 s after a nudge and then reloads', () => {
    let r = stuckAt(startState(), 6000);
    expect(r.action).toBe('nudge');
    r = stuckAt(r.state, 10_999);
    expect(r.action).toBe('none');
    r = stuckAt(r.state, 11_000);
    expect(r.action).toBe('reload');
  });

  it('follows the backoff ladder 5/10/20/30/60/60', () => {
    let state = startState();
    let now = 6000;
    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = stuckAt(state, now, { readyState: 0 });
      expect(r.action).toBe('reload');
      waits.push(r.state.nextAttemptAt - now);
      state = r.state;
      now = state.nextAttemptAt;
    }
    expect(waits).toEqual([5000, 10_000, 20_000, 30_000, 60_000, 60_000, 60_000]);
  });

  it('gives up after the maximum attempts', () => {
    let state = startState();
    let now = 6000;
    for (let i = 0; i < STALL_TIMING.maxAttempts; i++) {
      const r = stuckAt(state, now, { readyState: 0 });
      expect(r.action).not.toBe('give-up');
      state = r.state;
      now = state.nextAttemptAt;
    }
    const r = stuckAt(state, now, { readyState: 0 });
    expect(r.action).toBe('give-up');
    expect(r.state.attempts).toBe(0);
    expect(r.state.trackId).toBe('t1');
    expect(r.state.stalledSince).toBeNull();
  });

  it('gives up after 10 minutes even with attempts left', () => {
    const r = stuckAt(startState(), STALL_TIMING.giveUpAfterMs);
    expect(r.action).toBe('give-up');
  });

  it('offline: marks the stall but never spends attempts', () => {
    const r = stuckAt(startState(), 20_000, { online: false });
    expect(r.action).toBe('none');
    expect(r.state.stalledSince).toBe(20_000);
    expect(r.state.attempts).toBe(0);
  });

  it('attempts as soon as it is back online', () => {
    const offline = stuckAt(startState(), 20_000, { online: false });
    const r = stuckAt(offline.state, 21_000, { online: true });
    expect(r.action).toBe('nudge');
  });

  it('inactive (user pause) resets the stall but keeps attempts', () => {
    const attempt = stuckAt(startState(), 6000, { readyState: 0 });
    const r = stuckAt(attempt.state, 7000, { active: false, currentTime: 10 });
    expect(r.action).toBe('none');
    expect(r.state.stalledSince).toBeNull();
    expect(r.state.attempts).toBe(1);
    expect(r.state.lastProgressAt).toBe(7000);
  });

  it('counts a backwards seek as progress', () => {
    const r = stuckAt(startState(0, 100), 5000, { currentTime: 20 });
    expect(r.action).toBe('none');
    expect(r.state.lastTime).toBe(20);
    expect(r.state.lastProgressAt).toBe(5000);
  });

  it('resets everything when the track changes', () => {
    const attempt = stuckAt(startState(), 6000, { readyState: 0 });
    const r = stuckAt(attempt.state, 7000, { trackId: 't2', currentTime: 0 });
    expect(r.action).toBe('none');
    expect(r.state.trackId).toBe('t2');
    expect(r.state.attempts).toBe(0);
    expect(r.state.stalledSince).toBeNull();
  });
});

describe('forceAttempt', () => {
  it('increments attempts and reloads', () => {
    const r = forceAttempt(startState(), 1000);
    expect(r.action).toBe('reload');
    expect(r.state.attempts).toBe(1);
    expect(r.state.stalledSince).toBe(1000);
    expect(r.state.nextAttemptAt).toBe(1000 + STALL_TIMING.backoffMs[0]);
  });

  it('gives up at the maximum', () => {
    const state = { ...startState(), attempts: STALL_TIMING.maxAttempts };
    const r = forceAttempt(state, 1000);
    expect(r.action).toBe('give-up');
    expect(r.state.attempts).toBe(0);
    expect(r.state.trackId).toBe('t1');
  });
});

describe('isMidSongNetworkError', () => {
  it('detects code 2 mid-song', () => {
    expect(isMidSongNetworkError({ code: 2, mode: 'track', currentTime: 30 })).toBe(true);
  });

  it('treats any error during a watchdog reload as a failed retry', () => {
    expect(isMidSongNetworkError({ code: 4, mode: 'track', currentTime: 0, reloading: true })).toBe(
      true,
    );
    expect(isMidSongNetworkError({ code: 4, mode: 'radio', currentTime: 0, reloading: true })).toBe(
      false,
    );
  });

  it('ignores other cases', () => {
    expect(isMidSongNetworkError({ code: 2, mode: 'track', currentTime: 0 })).toBe(false);
    expect(isMidSongNetworkError({ code: 4, mode: 'track', currentTime: 30 })).toBe(false);
    expect(isMidSongNetworkError({ code: 2, mode: 'radio', currentTime: 30 })).toBe(false);
    expect(isMidSongNetworkError({ code: null, mode: 'track', currentTime: 30 })).toBe(false);
  });
});

describe('createStallWatchdog', () => {
  function setup() {
    let now = 0;
    let current: Omit<StallSample, 'now'> = {
      active: true,
      trackId: 't1',
      currentTime: 10,
      readyState: 4,
      online: true,
    };
    let tick: () => void = () => undefined;
    const deps = {
      sample: () => current,
      now: () => now,
      onAction: vi.fn(),
      onStalledChange: vi.fn(),
      log: vi.fn(),
      setInterval: vi.fn((fn: () => void) => {
        tick = fn;
        return 1;
      }),
    };
    const wd = createStallWatchdog(deps);
    return {
      deps,
      wd,
      tick: () => tick(),
      at: (ms: number) => {
        now = ms;
      },
      set: (over: Partial<Omit<StallSample, 'now'>>) => {
        current = { ...current, ...over };
      },
    };
  }

  it('starts the timer once with a 1 s default interval', () => {
    const { deps } = setup();
    expect(deps.setInterval).toHaveBeenCalledTimes(1);
    expect(deps.setInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
  });

  it('notifies stalled once and recovered on progress', () => {
    const t = setup();
    t.tick(); // adopts the track
    for (const ms of [1000, 3000, 4000, 5000]) {
      t.at(ms);
      t.tick();
    }
    expect(t.deps.onStalledChange).toHaveBeenCalledTimes(1);
    expect(t.deps.onStalledChange).toHaveBeenLastCalledWith(true);
    expect(t.wd.isStalled()).toBe(true);
    t.at(6000);
    t.set({ currentTime: 12 });
    t.tick();
    expect(t.deps.onStalledChange).toHaveBeenCalledTimes(2);
    expect(t.deps.onStalledChange).toHaveBeenLastCalledWith(false);
    expect(t.deps.log).toHaveBeenCalledWith('stall', expect.any(Object));
    expect(t.deps.log).toHaveBeenCalledWith('recovered', expect.any(Object));
  });

  it('forwards actions to onAction and logs the retry', () => {
    const t = setup();
    t.tick();
    t.at(6500);
    t.set({ readyState: 0 });
    t.tick();
    expect(t.deps.onAction).toHaveBeenCalledWith('reload');
    expect(t.deps.log).toHaveBeenCalledWith(
      'retry',
      expect.objectContaining({ attempts: 1, action: 'reload', trackId: 't1' }),
    );
  });

  it('retryNow forces a reload', () => {
    const t = setup();
    t.tick();
    t.at(500);
    t.wd.retryNow();
    expect(t.deps.onAction).toHaveBeenCalledWith('reload');
  });

  it('retryNow offline does nothing and spends no attempts', () => {
    const t = setup();
    t.tick();
    t.set({ online: false });
    t.at(500);
    t.wd.retryNow();
    expect(t.deps.onAction).not.toHaveBeenCalled();
    t.set({ online: true });
    t.wd.retryNow();
    expect(t.deps.log).toHaveBeenCalledWith('retry', expect.objectContaining({ attempts: 1 }));
  });

  it('gives up before reporting the stall as over', () => {
    const t = setup();
    t.tick();
    t.at(1000);
    t.wd.retryNow(); // marks the stall
    expect(t.deps.onStalledChange).toHaveBeenLastCalledWith(true);
    for (let i = 1; i < STALL_TIMING.maxAttempts; i++) t.wd.retryNow();
    const order: string[] = [];
    t.deps.onAction.mockImplementation((a: string) => order.push(a));
    t.deps.onStalledChange.mockImplementation((s: boolean) => order.push(`stalled:${s}`));
    t.wd.retryNow();
    expect(order).toEqual(['give-up', 'stalled:false']);
  });

  it('logs a freeze gap when checks are more than 15 s apart', () => {
    const t = setup();
    t.tick();
    t.at(20_000);
    t.tick();
    expect(t.deps.log).toHaveBeenCalledWith('freeze-gap', { gapMs: 20_000 });
  });
});
