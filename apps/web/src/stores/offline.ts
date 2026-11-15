import { create } from 'zustand';
import { t } from '../i18n';
import { loadPref, savePref } from '../lib/storage';
import { deleteAudio, downloadAudio, listCachedAudio, clearAllAudio } from '../offline/audioCache';
import { getDb } from '../offline/db';
import { planRotation, selectSwapOut, type OfflineEntry } from '../offline/planner';
import { useLibrary } from './library';
import { toast } from './ui';

export interface OfflineSettings {
  quotaMinutes: number;
  rotateAfterHours: number;
  autoFill: boolean;
  allowCellular: boolean;
}

export const QUOTA_OPTIONS = [30, 60, 120, 180, 300, 600, 1200];
export const ROTATE_OPTIONS = [6, 12, 24, 48, 72, 168];
const DEFAULTS: OfflineSettings = {
  quotaMinutes: 120,
  rotateAfterHours: 24,
  autoFill: true,
  allowCellular: false,
};
/** A song rotated out is not picked again for a week (unless the library is tiny). */
const COOLDOWN_MS = 7 * 24 * 3600 * 1000;
/** Fraction of a song that counts as "listened". */
export const LISTENED_THRESHOLD = 0.8;

interface OfflineState {
  ready: boolean;
  entries: Record<string, OfflineEntry>;
  downloading: Record<string, true>;
  running: boolean;
  lastRunAt: number | null;
  settings: OfflineSettings;
  storageBytes: number | null;
  persisted: boolean | null;

  init: () => Promise<void>;
  run: () => Promise<void>;
  scheduleRun: (delayMs?: number) => void;
  pin: (trackIds: string[]) => Promise<void>;
  unpin: (trackId: string) => Promise<void>;
  markListened: (trackId: string) => Promise<void>;
  updateSettings: (patch: Partial<OfflineSettings>) => void;
  clearAuto: () => Promise<void>;
  refreshStorage: () => Promise<void>;
}

/** Tracks the player must keep (current + next), registered by the player store. */
let protectedProvider: () => Set<string> = () => new Set();
export function setProtectedProvider(fn: () => Set<string>) {
  protectedProvider = fn;
}

function onCellular(): boolean {
  const conn = (navigator as Navigator & { connection?: { type?: string } }).connection;
  return conn?.type === 'cellular';
}

async function requestPersistence(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

let runTimer: ReturnType<typeof setTimeout> | undefined;

export const useOffline = create<OfflineState>((set, get) => {
  async function putEntry(entry: OfflineEntry) {
    await (await getDb()).put('offline', entry);
    set({ entries: { ...get().entries, [entry.trackId]: entry } });
  }

  async function removeEntry(trackId: string, rotated: boolean) {
    const db = await getDb();
    await deleteAudio(trackId);
    await db.delete('offline', trackId);
    if (rotated) await db.put('evicted', { trackId, evictedAt: Date.now() });
    const { [trackId]: _gone, ...entries } = get().entries;
    set({ entries });
  }

  async function download(
    trackId: string,
    mode: OfflineEntry['mode'],
  ): Promise<OfflineEntry | null> {
    const track = useLibrary.getState().tracks[trackId];
    if (!track) return null;
    set({ downloading: { ...get().downloading, [trackId]: true } });
    try {
      const remoteId = track.locations.cloudflare;
      if (!remoteId) throw new Error('Not stored in the cloud');
      const sizeBytes = await downloadAudio(trackId, remoteId, track.hasCover);
      const entry: OfflineEntry = {
        trackId,
        mode,
        durationMs: track.durationMs,
        sizeBytes,
        downloadedAt: Date.now(),
        listenedAt: null,
      };
      await putEntry(entry);
      return entry;
    } finally {
      const { [trackId]: _done, ...downloading } = get().downloading;
      set({ downloading });
    }
  }

  return {
    ready: false,
    entries: {},
    downloading: {},
    running: false,
    lastRunAt: null,
    settings: loadPref('offline-settings', DEFAULTS),
    storageBytes: null,
    persisted: null,

    /** Loads entries and drops any whose audio the browser evicted behind our back. */
    async init() {
      const db = await getDb();
      const stored = await db.getAll('offline');
      const cached = await listCachedAudio();
      const entries: Record<string, OfflineEntry> = {};
      for (const e of stored) {
        if (cached.has(e.trackId)) entries[e.trackId] = e;
        else await db.delete('offline', e.trackId);
      }
      const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
      set({
        entries,
        ready: true,
        persisted,
        lastRunAt: loadPref<{ at: number | null }>('offline-last-run', { at: null }).at,
      });
      void get().refreshStorage();
    },

    scheduleRun(delayMs = 1500) {
      clearTimeout(runTimer);
      runTimer = setTimeout(() => void get().run(), delayMs);
    },

    /** One rotation pass: plan → delete → download → swap out expired songs. */
    async run() {
      const lib = useLibrary.getState();
      if (get().running || !get().ready || !lib.loaded) return;
      set({ running: true });
      try {
        const db = await getDb();
        const { settings } = get();
        const now = Date.now();
        const evictedRows = await db.getAll('evicted');
        for (const row of evictedRows) {
          if (now - row.evictedAt > COOLDOWN_MS * 2) await db.delete('evicted', row.trackId);
        }
        // Only cloud songs rotate: songs stored on the device are always available offline.
        const tracks = lib.order
          .map((id) => lib.tracks[id])
          .filter(
            (tr) =>
              !!tr && !!tr.locations.cloudflare && !tr.locations.device && tr.kind !== 'podcast',
          )
          .map((tr) => ({ id: tr!.id, durationMs: tr!.durationMs }));

        const plan = planRotation({
          entries: Object.values(get().entries),
          tracks,
          quotaMs: settings.quotaMinutes * 60_000,
          rotateAfterMs: settings.rotateAfterHours * 3_600_000,
          autoFill: settings.autoFill,
          now,
          recentlyEvicted: new Map(evictedRows.map((r) => [r.trackId, r.evictedAt])),
          cooldownMs: COOLDOWN_MS,
          protectedIds: protectedProvider(),
        });

        for (const id of plan.removeNow) {
          await removeEntry(id, get().entries[id]?.mode === 'auto');
        }

        let downloadedMs = 0;
        const mayDownload = navigator.onLine && (settings.allowCellular || !onCellular());
        if (mayDownload && plan.download.length) {
          await requestPersistence();
          for (const id of plan.download) {
            if (!navigator.onLine) break;
            try {
              const entry = await download(id, 'auto');
              if (entry) downloadedMs += entry.durationMs;
            } catch {
              if (!navigator.onLine) break;
            }
          }
        }

        const durations = new Map(
          Object.values(get().entries).map((e) => [e.trackId, e.durationMs]),
        );
        for (const id of selectSwapOut(plan.swapOut, durations, downloadedMs)) {
          await removeEntry(id, true);
        }

        savePref('offline-last-run', { at: Date.now() });
        set({ lastRunAt: Date.now() });
      } catch (err) {
        console.error('Offline rotation failed', err);
      } finally {
        set({ running: false });
        void get().refreshStorage();
      }
    },

    async pin(trackIds) {
      const persisted = await requestPersistence();
      if (persisted !== null) set({ persisted });
      const todo = trackIds.filter((id) => get().entries[id]?.mode !== 'pinned');
      if (!todo.length) return;
      if (!navigator.onLine && todo.some((id) => !get().entries[id])) {
        toast(t('toast.offline'), 'error');
        return;
      }
      if (todo.length > 1) toast(t('toast.downloading', { count: todo.length }));
      let failed = 0;
      for (const id of todo) {
        const existing = get().entries[id];
        try {
          if (existing) await putEntry({ ...existing, mode: 'pinned' });
          else await download(id, 'pinned');
        } catch {
          failed++;
        }
      }
      toast(failed ? t('toast.downloadFailed') : t('toast.downloaded'), failed ? 'error' : 'info');
      void get().refreshStorage();
    },

    async unpin(trackId) {
      if (!get().entries[trackId]) return;
      await removeEntry(trackId, false);
      toast(t('toast.downloadRemoved'));
      void get().refreshStorage();
      get().scheduleRun(4000);
    },

    async markListened(trackId) {
      const entry = get().entries[trackId];
      if (entry && entry.listenedAt === null) await putEntry({ ...entry, listenedAt: Date.now() });
    },

    updateSettings(patch) {
      const settings = { ...get().settings, ...patch };
      savePref('offline-settings', settings);
      set({ settings });
      get().scheduleRun(800);
    },

    async clearAuto() {
      const autos = Object.values(get().entries).filter((e) => e.mode === 'auto');
      const keep = protectedProvider();
      for (const e of autos) if (!keep.has(e.trackId)) await removeEntry(e.trackId, true);
      if (!Object.keys(get().entries).length) await clearAllAudio();
      void get().refreshStorage();
    },

    async refreshStorage() {
      if (!navigator.storage?.estimate) return;
      const { usage } = await navigator.storage.estimate();
      set({ storageBytes: usage ?? null });
    },
  };
});
