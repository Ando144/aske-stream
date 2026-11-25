// Pure stall-detection logic: everything arrives through parameters or `deps`,
// so it can be unit-tested without audio, stores or timers.

export const STALL_TIMING = {
  progressEpsilon: 0.25, // seconds
  notifyAfterMs: 3_000,
  firstAttemptAfterMs: 6_000,
  backoffMs: [5_000, 10_000, 20_000, 30_000, 60_000], // wait after attempt n (last one repeats)
  maxAttempts: 8,
  giveUpAfterMs: 10 * 60_000,
  freezeGapMs: 15_000,
} as const;

export type StallAction = 'none' | 'nudge' | 'reload' | 'give-up';

export interface StallSample {
  now: number; // ms, monotonic (performance.now())
  active: boolean; // mode==='track' && !!audio.src && !audio.paused && !audio.ended
  trackId: string | null;
  currentTime: number;
  readyState: number; // HTMLMediaElement.readyState
  online: boolean;
}

export interface StallState {
  trackId: string | null;
  lastTime: number;
  lastProgressAt: number;
  stalledSince: number | null; // set once stuck >= notifyAfterMs
  attempts: number;
  nextAttemptAt: number;
}

export function initialStallState(now: number): StallState {
  return {
    trackId: null,
    lastTime: 0,
    lastProgressAt: now,
    stalledSince: null,
    attempts: 0,
    nextAttemptAt: 0,
  };
}

function backoffAfter(attempts: number): number {
  const table = STALL_TIMING.backoffMs;
  return table[Math.min(attempts - 1, table.length - 1)] ?? table[table.length - 1] ?? 60_000;
}

export function decideStall(
  state: StallState,
  sample: StallSample,
): { state: StallState; action: StallAction } {
  const { now } = sample;
  if (sample.trackId !== state.trackId) {
    const fresh = { ...initialStallState(now), trackId: sample.trackId };
    return { state: { ...fresh, lastTime: sample.currentTime }, action: 'none' };
  }
  if (!sample.active) {
    // Keep `attempts` so an error -> reload -> error loop cannot run forever.
    const idle = {
      ...state,
      stalledSince: null,
      lastTime: sample.currentTime,
      lastProgressAt: now,
    };
    return { state: idle, action: 'none' };
  }
  if (Math.abs(sample.currentTime - state.lastTime) >= STALL_TIMING.progressEpsilon) {
    const moving = {
      ...state,
      lastTime: sample.currentTime,
      lastProgressAt: now,
      attempts: 0,
      stalledSince: null,
      nextAttemptAt: 0,
    };
    return { state: moving, action: 'none' };
  }
  return decideWhileStuck(state, sample);
}

function decideWhileStuck(
  state: StallState,
  sample: StallSample,
): { state: StallState; action: StallAction } {
  const { now } = sample;
  const stuck = now - state.lastProgressAt;
  const exhausted = state.attempts >= STALL_TIMING.maxAttempts && now >= state.nextAttemptAt;
  if (stuck >= STALL_TIMING.giveUpAfterMs || exhausted) {
    return {
      state: { ...initialStallState(now), trackId: state.trackId, lastTime: state.lastTime },
      action: 'give-up',
    };
  }
  let next = state;
  if (stuck >= STALL_TIMING.notifyAfterMs && state.stalledSince === null) {
    next = { ...state, stalledSince: now };
  }
  if (!sample.online) return { state: next, action: 'none' };
  if (stuck >= STALL_TIMING.firstAttemptAfterMs && now >= next.nextAttemptAt) {
    const action = next.attempts === 0 && sample.readyState >= 1 ? 'nudge' : 'reload';
    const attempts = next.attempts + 1;
    return {
      state: { ...next, attempts, nextAttemptAt: now + backoffAfter(attempts) },
      action,
    };
  }
  return { state: next, action: 'none' };
}

/** Immediate reload (network error, notification play, back online). */
export function forceAttempt(
  state: StallState,
  now: number,
): { state: StallState; action: 'reload' | 'give-up' } {
  if (state.attempts >= STALL_TIMING.maxAttempts) {
    return {
      state: { ...initialStallState(now), trackId: state.trackId, lastTime: state.lastTime },
      action: 'give-up',
    };
  }
  const attempts = state.attempts + 1;
  return {
    state: {
      ...state,
      stalledSince: state.stalledSince ?? now,
      attempts,
      nextAttemptAt: now + backoffAfter(attempts),
    },
    action: 'reload',
  };
}

export function isMidSongNetworkError(e: {
  code: number | null;
  mode: 'idle' | 'track' | 'radio';
  currentTime: number;
  /** A watchdog reload is loading: any error is a failed retry, whatever its code. */
  reloading?: boolean;
}): boolean {
  if (e.mode !== 'track') return false;
  return e.reloading === true || (e.code === 2 && e.currentTime > 0);
}

export interface StallWatchdogDeps {
  sample: () => Omit<StallSample, 'now'>;
  now: () => number;
  onAction: (action: Exclude<StallAction, 'none'>) => void;
  onStalledChange: (stalled: boolean) => void;
  log: (
    event: 'stall' | 'recovered' | 'retry' | 'give-up' | 'freeze-gap',
    detail: Record<string, number | string | null>,
  ) => void;
  setInterval: (fn: () => void, ms: number) => unknown;
}

export function createStallWatchdog(
  deps: StallWatchdogDeps,
  intervalMs = 1000,
): { check: () => void; retryNow: () => void; isStalled: () => boolean } {
  let state = initialStallState(deps.now());
  let lastCheckAt: number | null = null;
  let lastActive = false;
  let stalled = false;

  function commit(next: StallState, action: StallAction, now: number): void {
    state = next;
    const nowStalled = state.stalledSince !== null;
    const changed = nowStalled !== stalled;
    // Giving up pauses first, so the notification never flickers back to "playing".
    if (action === 'give-up') {
      deps.log('give-up', { attempts: state.attempts, action, trackId: state.trackId });
      deps.onAction(action);
    }
    if (changed) {
      stalled = nowStalled;
      deps.log(stalled ? 'stall' : 'recovered', { trackId: state.trackId, at: now });
      deps.onStalledChange(stalled);
    }
    if (action === 'none' || action === 'give-up') return;
    deps.log('retry', { attempts: state.attempts, action, trackId: state.trackId });
    deps.onAction(action);
  }

  function check(): void {
    const now = deps.now();
    const raw = deps.sample();
    // A big gap while playing means the page was frozen (e.g. Android doze).
    if (lastCheckAt !== null && lastActive && now - lastCheckAt > STALL_TIMING.freezeGapMs) {
      deps.log('freeze-gap', { gapMs: now - lastCheckAt });
    }
    lastCheckAt = now;
    lastActive = raw.active;
    const result = decideStall(state, { ...raw, now });
    commit(result.state, result.action, now);
  }

  function retryNow(): void {
    // Offline attempts are wasted; the `online` event will trigger the retry.
    if (!deps.sample().online) return;
    const now = deps.now();
    const result = forceAttempt(state, now);
    commit(result.state, result.action, now);
  }

  deps.setInterval(check, intervalMs);
  return { check, retryNow, isStalled: () => stalled };
}
