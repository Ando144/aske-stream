import { create } from 'zustand';
import { GITHUB_REPO } from '../config';
import { t } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { AskeNative } from '../native/askeNative';
import { isNative } from '../native/platform';
import { compareVersions, toReleaseInfo, type ReleaseInfo } from '../native/releases';
import { toast } from './ui';

/**
 * In-app updates for the Android app (the web version updates by itself).
 * New versions are published as GitHub Releases with the APK attached.
 */

type Status =
  'idle' | 'checking' | 'upToDate' | 'available' | 'downloading' | 'needsPermission' | 'error';

let deviceAbis: string[] = [];

interface UpdaterState {
  status: Status;
  current: string;
  latest: ReleaseInfo | null;
  /** 0–1 while downloading (null when the size is unknown). */
  progress: number | null;
  lastCheck: number;
  error: string | null;
  init: () => Promise<void>;
  check: (manual?: boolean) => Promise<void>;
  update: () => Promise<void>;
  openPermission: () => Promise<void>;
}

const LATEST_URL = `https://api.github.com/repos/${GITHUB_REPO}/releases/latest`;
const AUTO_CHECK_EVERY = 12 * 60 * 60 * 1000;

let downloadedPath: string | null = null;

export const useUpdater = create<UpdaterState>((set, get) => ({
  status: 'idle',
  current: __APP_VERSION__,
  latest: null,
  progress: null,
  lastCheck: loadValue<number>('update-last-check', 0),
  error: null,

  async init() {
    if (!isNative) return;
    try {
      const info = await AskeNative.appInfo();
      deviceAbis = info.abis ?? [];
      set({ current: info.version });
    } catch {
      // keep the bundled version
    }
    void AskeNative.addListener('updateProgress', ({ received, total }) =>
      set({ progress: total > 0 ? Math.min(1, received / total) : null }),
    );
    // Coming back from Android's "Install unknown apps" screen: carry on.
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible' || get().status !== 'needsPermission') return;
      const info = await AskeNative.appInfo().catch(() => null);
      if (info?.canInstallUpdates) void get().update();
    });
    if (Date.now() - get().lastCheck > AUTO_CHECK_EVERY) void get().check(false);
  },

  async check(manual = true) {
    if (!isNative || get().status === 'checking' || get().status === 'downloading') return;
    set({ status: 'checking', error: null });
    try {
      const res = await fetch(LATEST_URL, { headers: { Accept: 'application/vnd.github+json' } });
      if (res.status === 404) throw new Error(t('update.noReleases'));
      if (!res.ok) throw new Error(`GitHub ${res.status}`);
      const latest = toReleaseInfo(await res.json(), deviceAbis);
      const now = Date.now();
      savePref('update-last-check', now);
      if (latest?.version !== get().latest?.version) downloadedPath = null;
      if (latest && compareVersions(latest.version, get().current) > 0) {
        set({ status: 'available', latest, lastCheck: now });
        const told = loadValue<string | null>('update-announced', null);
        if (!manual && told !== latest.version) {
          savePref('update-announced', latest.version);
          toast(t('update.toast', { version: latest.version }));
        }
      } else {
        set({ status: 'upToDate', latest, lastCheck: now });
      }
    } catch (err) {
      set({
        status: manual ? 'error' : 'idle',
        error: navigator.onLine ? (err as Error).message : t('toast.offline'),
      });
    }
  },

  async update() {
    const { latest } = get();
    if (!isNative || !latest) return;
    try {
      if (!downloadedPath) {
        set({ status: 'downloading', progress: 0, error: null });
        const { path } = await AskeNative.downloadUpdate({
          url: latest.apkUrl,
          version: latest.version,
        });
        downloadedPath = path;
      }
      const info = await AskeNative.appInfo();
      if (!info.canInstallUpdates) {
        set({ status: 'needsPermission' });
        return;
      }
      set({ status: 'available' });
      await AskeNative.installUpdate({ path: downloadedPath });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === 'needs_permission') set({ status: 'needsPermission' });
      else set({ status: 'error', error: (err as Error).message ?? String(err) });
    }
  },

  async openPermission() {
    await AskeNative.openInstallSettings().catch(() => undefined);
  },
}));
