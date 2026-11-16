import { create } from 'zustand';
import { api, ApiError, configureApi, onUnauthorized } from '../api/client';
import { loadValue, savePref } from '../lib/storage';
import { kvGet } from '../offline/db';
import { driveAvailable, getDriveToken, signOutDrive } from '../storage/drive/auth';
import { driveHome, driveQuota, flushDrive, resetDriveState } from '../storage/drive/home';
import { cloudflareHome, deviceHome } from '../storage/homes';
import type { HomeKind, LibraryHome } from '../storage/types';

/**
 * Which storage this installation uses. Replaces v1's "is this device
 * paired?" — Cloudflare is now one option among several.
 */
export interface CloudflareConnection {
  /** '' = this web app is served by the instance itself. */
  baseUrl: string;
  /** Device token for another origin; same origin uses the HttpOnly cookie instead. */
  token: string | null;
}

export interface SetupConfig {
  home: HomeKind;
  /** Only for the Cloudflare home. */
  cloudflare?: CloudflareConnection;
}

type Status = 'loading' | 'choose' | 'pair' | 'ready';

interface SetupState {
  status: Status;
  config: SetupConfig | null;
  /** True when this web app is served by an aske-stream Worker (pairing here is possible). */
  sameOriginApi: boolean;
  /**
   * The user opened the storage choice from Settings: the current storage
   * stays in use until they pick another one, and they can go back.
   */
  changing: boolean;
  /**
   * Last working Cloudflare connection, kept while another storage is in
   * use so coming back to Cloudflare never asks for the key again.
   * Only "Unpair" forgets it.
   */
  savedCloudflare: CloudflareConnection | null;
  init: () => Promise<void>;
  chooseDevice: () => void;
  /**
   * Opens Google's "allow access" window (must be called right after a tap)
   * and starts using Google Drive.
   */
  chooseDrive: () => Promise<void>;
  /** Forgets the Google account on this device. Nothing in Drive is deleted. */
  disconnectDrive: () => Promise<void>;
  /** Reuses the saved connection when it still works; otherwise asks for the key. */
  chooseCloudflare: () => Promise<void>;
  connectCloudflare: (key: string, baseUrl?: string) => Promise<void>;
  /** From Settings: shows the storage choice without leaving the current storage. */
  changeStorage: () => void;
  /** Leaves the storage choice and keeps everything as it was. */
  cancelChange: () => void;
  /** From the key screen back to the storage choice. */
  backToChoice: () => void;
  /** Signs out of Cloudflare and forgets the connection on this device. */
  unpair: () => Promise<void>;
}

const STORAGE_KEY = 'setup';
const CLOUDFLARE_KEY = 'cloudflare-connection';
export const DRIVE_EMAIL_KEY = 'drive-email';

function apply(config: SetupConfig | null) {
  if (config?.home === 'cloudflare' && config.cloudflare) {
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

export const useSetup = create<SetupState>((set, get) => {
  /** Saves and starts using a configuration. */
  function use(config: SetupConfig) {
    savePref(STORAGE_KEY, config);
    if (config.cloudflare) {
      savePref(CLOUDFLARE_KEY, config.cloudflare);
      set({ savedCloudflare: config.cloudflare });
    }
    apply(config);
    set({ config, status: 'ready', changing: false });
  }

  return {
    status: 'loading',
    config: null,
    sameOriginApi: false,
    changing: false,
    savedCloudflare: null,

    async init() {
      const saved = loadValue<SetupConfig | null>(STORAGE_KEY, null);
      const savedCloudflare =
        loadValue<CloudflareConnection | null>(CLOUDFLARE_KEY, null) ?? saved?.cloudflare ?? null;
      set({ savedCloudflare });
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
            use({ home: 'cloudflare', cloudflare: { baseUrl: '', token: null } });
            return;
          }
        } catch {
          // fall through to the choice
        }
      } else if (await kvGet<boolean>('paired')) {
        // v1 installation opened while offline
        const config: SetupConfig = {
          home: 'cloudflare',
          cloudflare: { baseUrl: '', token: null },
        };
        set({ config, status: 'ready' });
        return;
      }
      set({ status: 'choose' });
    },

    chooseDevice() {
      void flushDrive().catch(() => undefined);
      use({ home: 'device' });
    },

    async chooseDrive() {
      const { config, changing } = get();
      if (config?.home === 'drive' && changing) {
        get().cancelChange();
        return;
      }
      if (!driveAvailable()) throw new Error('drive_unavailable');
      await getDriveToken(true);
      // Another Google account than last time: its library is a different one.
      const { email } = await driveQuota().catch(() => ({ email: '' }));
      const previous = loadValue<string>(DRIVE_EMAIL_KEY, '');
      if (email && previous && email !== previous) await resetDriveState();
      if (email) savePref(DRIVE_EMAIL_KEY, email);
      use({ home: 'drive' });
    },

    async disconnectDrive() {
      await flushDrive().catch(() => undefined);
      await signOutDrive();
      await resetDriveState();
      savePref(DRIVE_EMAIL_KEY, '');
      if (get().config?.home === 'drive') {
        savePref(STORAGE_KEY, null);
        set({ config: null, status: 'choose', changing: false });
      }
    },

    async chooseCloudflare() {
      void flushDrive().catch(() => undefined);
      const { config, savedCloudflare, sameOriginApi } = get();
      if (config?.home === 'cloudflare' && get().changing) {
        get().cancelChange();
        return;
      }
      // Same origin: the session cookie may still be valid even with nothing saved.
      const candidate = savedCloudflare ?? (sameOriginApi ? { baseUrl: '', token: null } : null);
      if (candidate) {
        configureApi(candidate.baseUrl, candidate.token);
        try {
          if ((await api.status()).paired) {
            use({ home: 'cloudflare', cloudflare: candidate });
            return;
          }
        } catch (err) {
          // Offline with a connection that worked before: use it, it reconnects by itself.
          if (savedCloudflare && err instanceof ApiError && err.status === 0) {
            use({ home: 'cloudflare', cloudflare: candidate });
            return;
          }
        }
      }
      set({ status: 'pair' });
    },

    async connectCloudflare(key, baseUrl = '') {
      configureApi(baseUrl, null);
      try {
        const { token } = await api.pair(key);
        // Same origin: the HttpOnly cookie is enough. Other origin: keep the device token.
        use({ home: 'cloudflare', cloudflare: { baseUrl, token: baseUrl ? token : null } });
      } catch (err) {
        apply(get().config);
        throw err;
      }
    },

    changeStorage() {
      set({ status: 'choose', changing: true });
    },

    cancelChange() {
      apply(get().config);
      set({ status: get().config ? 'ready' : 'choose', changing: false });
    },

    backToChoice() {
      apply(get().config);
      set({ status: 'choose' });
    },

    async unpair() {
      const conn = get().savedCloudflare ?? get().config?.cloudflare;
      if (conn) {
        configureApi(conn.baseUrl, conn.token);
        await api.logout().catch(() => undefined);
      }
      savePref(CLOUDFLARE_KEY, null);
      set({ savedCloudflare: null });
      if (get().config?.home === 'cloudflare') {
        savePref(STORAGE_KEY, null);
        configureApi('', null);
        set({ config: null, status: 'choose', changing: false });
      } else {
        apply(get().config);
      }
    },
  };
});

/** The library home currently in use. */
export function getHome(): LibraryHome {
  const home = useSetup.getState().config?.home;
  return home === 'cloudflare' ? cloudflareHome : home === 'drive' ? driveHome : deviceHome;
}

onUnauthorized(() => {
  if (useSetup.getState().config?.home === 'cloudflare') {
    useSetup.setState({ status: 'pair', changing: false });
  }
});
