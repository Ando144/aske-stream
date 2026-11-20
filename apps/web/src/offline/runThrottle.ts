interface RunThrottleOptions {
  minGapMs: number;
  mayRun: () => Promise<boolean>;
  run: () => void;
  now?: () => number;
}

/** Runs `run` at most once per `minGapMs`, and only when the async `mayRun` check allows it. */
export function createRunThrottle(opts: RunThrottleOptions): () => void {
  const now = opts.now ?? Date.now;
  let lastRun = Number.NEGATIVE_INFINITY;
  let checking = false;

  return () => {
    const calledAt = now();
    if (calledAt - lastRun < opts.minGapMs || checking) return;
    checking = true;
    opts
      .mayRun()
      .then((ok) => {
        if (!ok) return;
        lastRun = calledAt;
        opts.run();
      })
      .catch(() => {
        // A failed check just means we try again on the next call.
      })
      .finally(() => {
        checking = false;
      });
  };
}
