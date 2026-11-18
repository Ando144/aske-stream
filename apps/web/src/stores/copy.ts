import { create } from 'zustand';
import { loadValue } from '../lib/storage';
import { kvGet, kvSet } from '../offline/db';
import { buildCopyPlan, spaceCheck, type IdMap } from '../storage/copy/plan';
import { endpointFor } from '../storage/copy/endpoints';
import { runCopy, type CopyProgress, type CopyStop } from '../storage/copy/run';
import { deviceHome } from '../storage/homes';
import type { Destination } from '../storage/types';
import { useLibrary } from './library';
import { DRIVE_EMAIL_KEY, useSetup } from './setup';

/**
 * Copies music between storages (device, Google Drive, Cloudflare). Nothing
 * is deleted from the source. A copy can be stopped and resumed at any time:
 * what is already in the destination is never copied twice.
 */

export interface CopyJob {
  from: Destination;
  to: Destination;
  status: 'offered' | 'running' | 'paused' | 'done' | 'dismissed';
  progress: CopyProgress;
  stopped: CopyStop;
  pendingCount: number;
  missingBytes: number;
}

interface CopyState {
  job: CopyJob | null;
  running: boolean;
  restore: () => Promise<void>;
  offer: (from: Destination, to: Destination) => Promise<void>;
  start: () => Promise<void>;
  stop: () => void;
  dismiss: () => Promise<void>;
  availableSources: () => Destination[];
}

const JOB_KEY = 'copy-job';
const LEGACY_MAP_KEY = 'copy-to-drive-map';
const mapKey = (from: Destination, to: Destination) => `copy-map:${from}>${to}`;

let stopRequested = false;
let deviceHasMusic = false;
let legacyChecked = false;

function endpoint(kind: Destination) {
  const { savedCloudflare, config } = useSetup.getState();
  return endpointFor(kind, savedCloudflare ?? config?.cloudflare ?? null);
}

async function readMap(from: Destination, to: Destination): Promise<IdMap> {
  const current = await kvGet<IdMap>(mapKey(from, to));
  if (current) return current;
  if (from === 'device' && to === 'drive') return (await kvGet<IdMap>(LEGACY_MAP_KEY)) ?? {};
  return {};
}

async function saveJob(job: CopyJob | null): Promise<void> {
  await kvSet(JOB_KEY, job);
}

async function refreshDeviceHasMusic(): Promise<void> {
  const snap = await deviceHome.load();
  deviceHasMusic = (snap?.tracks.length ?? 0) > 0;
}

async function buildJob(from: Destination, to: Destination): Promise<CopyJob | null> {
  const [src, dest] = await Promise.all([endpoint(from).load(), endpoint(to).load()]);
  const map = await readMap(from, to);
  const plan = buildCopyPlan(src.tracks, dest.tracks, map, to);
  if (plan.todo.length === 0) return null;
  const free = await endpoint(to)
    .freeBytes()
    .catch(() => null);
  const already = Object.keys(plan.already).length;
  return {
    from,
    to,
    status: 'offered',
    stopped: null,
    pendingCount: plan.todo.length,
    missingBytes: spaceCheck(plan.todoBytes, free).missingBytes,
    progress: {
      total: src.tracks.length,
      done: already + plan.unsupported.length,
      copied: 0,
      already,
      unsupported: plan.unsupported.length,
      failed: [],
      playlistOverflow: [],
    },
  };
}

export const useCopy = create<CopyState>((set, get) => {
  async function update(patch: Partial<CopyJob>): Promise<void> {
    const job = get().job;
    if (!job) return;
    const next = { ...job, ...patch };
    set({ job: next });
    await saveJob(next);
  }

  async function finish(stopped: CopyStop, progress: CopyProgress): Promise<void> {
    await update({
      status: stopped ? 'paused' : 'done',
      stopped,
      progress,
      pendingCount: Math.max(0, progress.total - progress.done),
    });
    await useLibrary.getState().load();
  }

  return {
    job: null,
    running: false,

    async restore() {
      void refreshDeviceHasMusic();
      if (get().running) return;
      const saved = (await kvGet<CopyJob | null>(JOB_KEY)) ?? null;
      if (saved) {
        const job: CopyJob = saved.status === 'running' ? { ...saved, status: 'paused' } : saved;
        set({ job });
        if (job !== saved) await saveJob(job);
        return;
      }
      // Users of v0.5 who switched to Drive may still have songs on this device.
      if (legacyChecked || useSetup.getState().config?.home !== 'drive') return;
      legacyChecked = true;
      await get().offer('device', 'drive');
    },

    async offer(from, to) {
      if (get().running || from === to) return;
      try {
        const job = await buildJob(from, to);
        set({ job });
        await saveJob(job);
      } catch (err) {
        console.warn('Could not prepare the copy', err);
      }
    },

    async start() {
      const job = get().job;
      if (get().running || !job || job.status === 'dismissed') return;
      stopRequested = false;
      set({ running: true });
      await update({ status: 'running', stopped: null });
      try {
        const { from, to } = job;
        const target = useSetup.getState().config?.home === to;
        const result = await runCopy({
          from: endpoint(from),
          to: endpoint(to),
          getMap: () => readMap(from, to),
          saveMap: (m) => kvSet(mapKey(from, to), m),
          shouldStop: () => stopRequested,
          onProgress: (progress) => void update({ progress }),
          onTrackCopied: (t) => {
            if (target) useLibrary.getState().upsertTracks([t]);
          },
        });
        await finish(result.stopped, result.progress);
      } catch (err) {
        console.warn('The copy stopped unexpectedly', err);
        await update({ status: 'paused', stopped: null });
      } finally {
        set({ running: false });
      }
    },

    stop() {
      stopRequested = true;
    },

    async dismiss() {
      await update({ status: 'dismissed' });
    },

    availableSources() {
      const { config, savedCloudflare } = useSetup.getState();
      const sources: Destination[] = [];
      if (deviceHasMusic) sources.push('device');
      if (loadValue<string>(DRIVE_EMAIL_KEY, '')) sources.push('drive');
      if (savedCloudflare) sources.push('cloudflare');
      return sources.filter((s) => s !== config?.home);
    },
  };
});

useSetup.subscribe((state, prev) => {
  const before = prev.config?.home;
  const after = state.config?.home;
  if (before && after && before !== after) void useCopy.getState().offer(before, after);
});
