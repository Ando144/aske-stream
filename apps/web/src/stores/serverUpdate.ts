import { isServerOutdated } from '@aske/shared/version';
import { create } from 'zustand';
import { api } from '../api/client';
import { loadValue, savePref } from '../lib/storage';
import { useSetup } from './setup';

const DISMISSED_KEY = 'server-update-dismissed';

interface ServerUpdateState {
  serverVersion: string | null;
  /** The Worker is older than this app and the notice was not dismissed for this app version. */
  outdated: boolean;
  /** The Worker is older than this app, regardless of the banner dismissal (for Settings). */
  behind: boolean;
  /** App version for which the user dismissed the notice. */
  dismissedVersion: string | null;
  check(): Promise<void>;
  /** The server answered like an old version (e.g. a missing endpoint). */
  markOutdated(): void;
  dismiss(): void;
}

export const useServerUpdate = create<ServerUpdateState>((set, get) => ({
  serverVersion: null,
  outdated: false,
  behind: false,
  dismissedVersion: loadValue<string | null>(DISMISSED_KEY, null),

  async check() {
    if (useSetup.getState().config?.home !== 'cloudflare') {
      set({ serverVersion: null, outdated: false, behind: false });
      return;
    }
    try {
      const { version } = await api.health();
      const behind = isServerOutdated(version, __APP_VERSION__);
      set({
        serverVersion: version ?? null,
        behind,
        outdated: behind && get().dismissedVersion !== __APP_VERSION__,
      });
    } catch {
      // Offline or unreachable: keep what we knew; the next check will try again.
    }
  },

  markOutdated() {
    set({ behind: true });
    if (get().dismissedVersion !== __APP_VERSION__) set({ outdated: true });
  },

  dismiss() {
    savePref(DISMISSED_KEY, __APP_VERSION__);
    set({ outdated: false, dismissedVersion: __APP_VERSION__ });
  },
}));
