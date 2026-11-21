interface RunThrottleOptions {
  minGapMs: number;
  mayRun: () => Promise<boolean>;
  run: () => void | Promise<void>;
  now?: () => number;
}

/** Runs `run` at most once per `minGapMs`, and only when the async `mayRun` check allows it. */
export function createRunThrottle(opts: RunThrottleOptions): () => void {
  const now = opts.now ?? Date.now;
  let lastRun = Number.NEGATIVE_INFINITY;
  let checking = false;

  async function attempt(calledAt: number): Promise<void> {
    let allowed: boolean;
    try {
      allowed = await opts.mayRun();
    } catch (err) {
      console.warn('Run throttle check failed', err);
      return;
    }
    if (!allowed) return;
    // Set before running so a failing run is not retried in a loop.
    lastRun = calledAt;
    try {
      await opts.run();
    } catch (err) {
      console.error('Throttled run failed', err);
    }
  }

  return () => {
    const calledAt = now();
    if (calledAt - lastRun < opts.minGapMs || checking) return;
    checking = true;
    void attempt(calledAt).finally(() => {
      checking = false;
    });
  };
}
