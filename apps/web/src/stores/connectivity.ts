import { create, type StoreApi, type UseBoundStore } from 'zustand';
import { api } from '../api/client';
import { HUB_URL } from '../config';
import { hubAvailable } from '../hub/client';
import { BOOT_TIMEOUT_MS, withTimeout } from '../lib/timeout';
import { useSetup } from './setup';

export type ConnectionStatus = 'checking' | 'online' | 'offline';

export const RETRY_DELAYS_MS = [5000, 10000, 20000, 30000, 60000];

export function nextRetryDelay(attempt: number): number {
  const index = Math.min(Math.max(attempt, 0), RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[index]!;
}

export interface ConnectivityDeps {
  probe: (timeoutMs: number) => Promise<boolean>;
  /** Returns a function that cancels the scheduled call. */
  schedule: (fn: () => void, ms: number) => () => void;
}

export interface ConnectivityState {
  status: ConnectionStatus;
  check(): Promise<boolean>;
  reportTrouble(): void;
}

const reconnectListeners = new Set<() => void>();

/** Fired only on offline -> online. */
export function onReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener);
  return () => reconnectListeners.delete(listener);
}

function notifyReconnect() {
  for (const listener of [...reconnectListeners]) {
    try {
      listener();
    } catch (err) {
      console.warn('Reconnect listener failed', err);
    }
  }
}

export function createConnectivityStore(
  deps: ConnectivityDeps,
): UseBoundStore<StoreApi<ConnectivityState>> {
  return create<ConnectivityState>((set, get) => {
    let attempt = 0;
    let cancelRetry: (() => void) | null = null;
    let pending: Promise<boolean> | null = null;

    const clearRetry = () => {
      cancelRetry?.();
      cancelRetry = null;
    };

    async function runProbe(): Promise<boolean> {
      clearRetry();
      let ok = false;
      try {
        ok = await deps.probe(BOOT_TIMEOUT_MS);
      } catch (err) {
        console.warn('Connectivity probe failed', err);
      }
      const wasOffline = get().status === 'offline';
      if (ok) {
        attempt = 0;
        set({ status: 'online' });
        if (wasOffline) notifyReconnect();
      } else {
        set({ status: 'offline' });
        cancelRetry = deps.schedule(() => void get().check(), nextRetryDelay(attempt++));
      }
      return ok;
    }

    return {
      status: 'checking',
      check() {
        pending ??= runProbe().finally(() => {
          pending = null;
        });
        return pending;
      },
      reportTrouble() {
        if (get().status === 'online') void get().check();
      },
    };
  });
}

async function defaultProbe(timeoutMs: number): Promise<boolean> {
  if (!navigator.onLine) return false;
  try {
    if (useSetup.getState().config?.home === 'cloudflare') {
      await withTimeout(api.health(), timeoutMs);
      return true;
    }
    if (!hubAvailable()) return navigator.onLine;
    await fetch(HUB_URL.replace(/\/+$/, '') + '/hub/v1/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(timeoutMs),
    });
    return true;
  } catch (err) {
    // Any HTTP answer from our own server means it is reachable.
    return (
      (err as { status?: number }).status !== undefined && (err as { status: number }).status > 0
    );
  }
}

export const useConnectivity = createConnectivityStore({
  probe: defaultProbe,
  schedule: (fn, ms) => {
    const id = setTimeout(fn, ms);
    return () => clearTimeout(id);
  },
});

export function canUseNetwork(): boolean {
  return navigator.onLine && useConnectivity.getState().status !== 'offline';
}

let stopWatch: (() => void) | null = null;

export function startConnectivityWatch(): () => void {
  if (stopWatch) return stopWatch;
  const goOffline = () => {
    useConnectivity.setState({ status: 'offline' });
    void useConnectivity.getState().check();
  };
  const goOnline = () => void useConnectivity.getState().check();
  const onVisible = () => {
    if (document.visibilityState === 'visible' && useConnectivity.getState().status === 'offline') {
      goOnline();
    }
  };
  window.addEventListener('offline', goOffline);
  window.addEventListener('online', goOnline);
  document.addEventListener('visibilitychange', onVisible);
  stopWatch = () => {
    window.removeEventListener('offline', goOffline);
    window.removeEventListener('online', goOnline);
    document.removeEventListener('visibilitychange', onVisible);
    stopWatch = null;
  };
  return stopWatch;
}
