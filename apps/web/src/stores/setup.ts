import { create } from 'zustand';
import { api, ApiError, configureApi, onUnauthorized } from '../api/client';
import { loadValue, savePref } from '../lib/storage';
import { kvGet } from '../offline/db';
import { cloudflareHome, deviceHome } from '../storage/homes';
import type { HomeKind, LibraryHome } from '../storage/types';

/**
 * Which storage this installation uses. Replaces v1's "is this device
 * paired?" — Cloudflare is now one option among several.
 */
export interface SetupConfig {
  home: HomeKind;
  /** Only for the Cloudflare home. baseUrl '' = this web app is served by the instance. */
  cloudflare?: { baseUrl: string; token: string | null };
}

type Status = 'loading' | 'choose' | 'pair' | 'ready';

interface SetupState {
  status: Status;
  config: SetupConfig | null;
  /** True when this web app is served by an aske-stream Worker (pairing here is possible). */
  sameOriginApi: boolean;
  init: () => Promise<void>;
  chooseDevice: () => void;
  /** Opens the pairing step for a Cloudflare instance. */
  startCloudflare: () => void;
  connectCloudflare: (key: string, baseUrl?: string) => Promise<void>;
  /** Back to the storage choice. Data stays where it is. */
  reset: () => Promise<void>;
}

const STORAGE_KEY = 'setup';

function apply(config: SetupConfig) {
  if (config.home === 'cloudflare' && config.cloudflare) {
    configureApi(config.cloudflare.baseUrl, config.cloudflare.token);
  } else {
    configureApi('', null);
  }
}

async function hasSameOriginApi(): Promise<boolean> {
  try {
    return (await api.health()).ok === true;
  } catch {
    return false;
  }
}

export const useSetup = create<SetupState>((set, get) => ({
  status: 'loading',
  config: null,
  sameOriginApi: false,

  async init() {
    const saved = loadValue<SetupConfig | null>(STORAGE_KEY, null);
    if (saved) {
      apply(saved);
      set({ config: saved });
      if (saved.home !== 'cloudflare') {
        set({ status: 'ready', sameOriginApi: await hasSameOriginApi() });
        return;
      }
      try {
        const { paired } = await api.status();
        set({ status: paired ? 'ready' : 'pair', sameOriginApi: !saved.cloudflare?.baseUrl });
      } catch (err) {
        // Offline: trust the saved configuration so downloaded music keeps playing.
        set({ status: err instanceof ApiError && err.status === 0 ? 'ready' : 'pair' });
      }
      return;
    }

    // First run — or an installation from v1, which was always "Cloudflare, same origin".
    configureApi('', null);
    const sameOriginApi = await hasSameOriginApi();
    set({ sameOriginApi });
    if (sameOriginApi) {
      try {
        if ((await api.status()).paired) {
          const config: SetupConfig = {
            home: 'cloudflare',
            cloudflare: { baseUrl: '', token: null },
          };
          savePref(STORAGE_KEY, config);
          set({ config, status: 'ready' });
          return;
        }
      } catch {
        // fall through to the choice
      }
    } else if (await kvGet<boolean>('paired')) {
      // v1 installation opened while offline
      const config: SetupConfig = { home: 'cloudflare', cloudflare: { baseUrl: '', token: null } };
      set({ config, status: 'ready' });
      return;
    }
    set({ status: 'choose' });
  },

  chooseDevice() {
    const config: SetupConfig = { home: 'device' };
    savePref(STORAGE_KEY, config);
    apply(config);
    set({ config, status: 'ready' });
  },

  startCloudflare() {
    set({ status: 'pair' });
  },

  async connectCloudflare(key, baseUrl = '') {
    configureApi(baseUrl, null);
    const { token } = await api.pair(key);
    // Same origin: the HttpOnly cookie is enough. Other origin: keep the device token.
    const config: SetupConfig = {
      home: 'cloudflare',
      cloudflare: { baseUrl, token: baseUrl ? token : null },
    };
    savePref(STORAGE_KEY, config);
    apply(config);
    set({ config, status: 'ready' });
  },

  async reset() {
    if (get().config?.home === 'cloudflare' && !get().config?.cloudflare?.baseUrl) {
      await api.logout().catch(() => undefined);
    }
    savePref(STORAGE_KEY, null);
    configureApi('', null);
    set({ config: null, status: 'choose' });
  },
}));

/** The library home currently in use. */
export function getHome(): LibraryHome {
  return useSetup.getState().config?.home === 'cloudflare' ? cloudflareHome : deviceHome;
}

onUnauthorized(() => {
  if (useSetup.getState().config?.home === 'cloudflare') useSetup.setState({ status: 'pair' });
});
