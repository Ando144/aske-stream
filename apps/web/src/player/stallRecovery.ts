import { createStallWatchdog } from './stallWatchdog';

/** Wires the pure stall watchdog to the <audio> element and the player store. */

export interface StallRecoveryDeps {
  mode: () => 'idle' | 'track' | 'radio';
  currentId: () => string | null;
  reloadCurrent: () => void;
  /** Called after the silent pause when the watchdog gives up (clear the buffering flag). */
  onGiveUp: () => void;
  setStalled: (stalled: boolean) => void;
  setRetryHandler: (fn: () => void) => void;
}

export function attachStallRecovery(audio: HTMLAudioElement, deps: StallRecoveryDeps) {
  const watchdog = createStallWatchdog({
    sample: () => ({
      active: deps.mode() === 'track' && !!audio.src && !audio.paused && !audio.ended,
      trackId: deps.currentId(),
      currentTime: audio.currentTime,
      readyState: audio.readyState,
      online: navigator.onLine,
    }),
    now: () => performance.now(),
    onAction: (action) => {
      if (action === 'nudge') {
        const here = audio.currentTime;
        audio.currentTime = here;
        void audio.play().catch(() => undefined);
      } else if (action === 'reload') {
        deps.reloadCurrent();
      } else {
        audio.pause();
        deps.onGiveUp();
      }
    },
    onStalledChange: deps.setStalled,
    log: (event, detail) => console.warn('[aske-stall]', event, detail),
    setInterval: (fn, ms) => setInterval(fn, ms),
  });
  deps.setRetryHandler(() => watchdog.retryNow());
  audio.addEventListener('stalled', () => watchdog.check());
  audio.addEventListener('waiting', () => watchdog.check());
  window.addEventListener('online', () => {
    if (watchdog.isStalled()) watchdog.retryNow();
  });
  return watchdog;
}
