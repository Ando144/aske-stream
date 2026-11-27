import type { ConnectionStatus } from '../stores/connectivity';

// Long enough that the logo does not just flicker on screen.
export const BOOT_MIN_SPLASH_MS = 400;
export const SPLASH_EXIT_MS = 300;
export const BOOT_MAX_WAIT_MS = 5000;
export const BOOT_PULSE_AFTER_MS = 1000;
const REDUCED_MOTION_EXIT_MS = 150;

/** Splash durations; reduced motion only shortens the fade. */
export function splashTimings(reducedMotion: boolean): { minMs: number; exitMs: number } {
  return {
    minMs: BOOT_MIN_SPLASH_MS,
    exitMs: reducedMotion ? REDUCED_MOTION_EXIT_MS : SPLASH_EXIT_MS,
  };
}

/** True when opening is taking long enough that the logo should show it is still working. */
export function shouldPulse(elapsedMs: number, reducedMotion: boolean): boolean {
  return !reducedMotion && elapsedMs >= BOOT_PULSE_AFTER_MS;
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
