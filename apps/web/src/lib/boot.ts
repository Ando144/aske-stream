import type { ConnectionStatus } from '../stores/connectivity';

// The logo finishes drawing at 1.2 s; the extra 0.6 s lets people see it complete.
export const BOOT_MIN_SPLASH_MS = 1800;
export const SPLASH_EXIT_MS = 500;
export const BOOT_MAX_WAIT_MS = 5000;
export const BOOT_CONNECTING_HINT_MS = 1500;

/** Splash durations; with reduced motion the logo is static, so it is short and fade-only. */
export function splashTimings(reducedMotion: boolean): { minMs: number; exitMs: number } {
  return reducedMotion
    ? { minMs: 600, exitMs: 200 }
    : { minMs: BOOT_MIN_SPLASH_MS, exitMs: SPLASH_EXIT_MS };
}

/** True when the splash screen can go away. */
export function bootReady(
  s: {
    setupLoading: boolean;
    elapsedMs: number;
    connection: ConnectionStatus;
  },
  minMs: number = BOOT_MIN_SPLASH_MS,
): boolean {
  if (s.setupLoading || s.elapsedMs < minMs) return false;
  return s.connection !== 'checking' || s.elapsedMs >= BOOT_MAX_WAIT_MS;
}
