import type { ConnectionStatus } from '../stores/connectivity';

export const BOOT_MAX_WAIT_MS = 5000;

/** True when the app can be shown; lib/bootSplash.ts adds the minimum time on screen. */
export function bootReady(s: {
  setupLoading: boolean;
  elapsedMs: number;
  connection: ConnectionStatus;
}): boolean {
  if (s.setupLoading) return false;
  return s.connection !== 'checking' || s.elapsedMs >= BOOT_MAX_WAIT_MS;
}
