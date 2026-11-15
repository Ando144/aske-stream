import { create } from 'zustand';
import { api, ApiError, onUnauthorized } from '../api/client';
import { kvGet, kvSet } from '../offline/db';

type Status = 'checking' | 'paired' | 'unpaired';

interface SessionState {
  status: Status;
  check: () => Promise<void>;
  pair: (key: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Single-owner model: no accounts, just "is this device paired?". When the
 * network is down we trust the last known state so the offline cache keeps
 * working with the phone in airplane mode.
 */
export const useSession = create<SessionState>((set) => ({
  status: 'checking',

  async check() {
    try {
      const { paired } = await api.status();
      await kvSet('paired', paired);
      set({ status: paired ? 'paired' : 'unpaired' });
    } catch (err) {
      if (err instanceof ApiError && err.status === 0) {
        const wasPaired = await kvGet<boolean>('paired');
        set({ status: wasPaired ? 'paired' : 'unpaired' });
      } else {
        set({ status: 'unpaired' });
      }
    }
  },

  async pair(key) {
    await api.pair(key);
    await kvSet('paired', true);
    set({ status: 'paired' });
  },

  async logout() {
    await api.logout().catch(() => undefined);
    await kvSet('paired', false);
    set({ status: 'unpaired' });
  },
}));

onUnauthorized(() => {
  void kvSet('paired', false);
  useSession.setState({ status: 'unpaired' });
});
