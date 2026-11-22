import type { ConnectionStatus } from '../stores/connectivity';

export const BOOT_MIN_SPLASH_MS = 1000;
export const BOOT_MAX_WAIT_MS = 5000;
export const BOOT_CONNECTING_HINT_MS = 1500;

/** True when the splash screen can go away. */
export function bootReady(s: {
  setupLoading: boolean;
  elapsedMs: number;
  connection: ConnectionStatus;
}): boolean {
  if (s.setupLoading || s.elapsedMs < BOOT_MIN_SPLASH_MS) return false;
  return s.connection !== 'checking' || s.elapsedMs >= BOOT_MAX_WAIT_MS;
}
