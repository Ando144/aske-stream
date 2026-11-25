import { create } from 'zustand';
import { LIMITS } from '@aske/shared';
import { youtubePlaylistId, youtubeVideoId } from '@aske/shared/youtube';
import { api } from '../api/client';
import { batchForRetry } from '../downloads/batch';
import { friendlyError, saveErrorText } from '../downloads/errors';
import {
  flushImportSync,
  pruneImports,
  rememberImport,
  resolvePlaylist,
  scheduleImportSync,
  settleImports,
  syncImport,
} from '../downloads/imports';
import {
  STORE_KEY,
  buildJobs,
  downloadedPatch,
  endedPatch,
  engineAfterFailure,
  finishCounts,
  isActive,
  knownToNative,
  mergeJobs,
  persist,
  progressPatch,
  requeuePatch,
  sendOutcome,
  type DownloadsState,
  type NewDownload,
} from '../downloads/jobsStore';
import { createDownloadNotifier } from '../downloads/notifier';
import {
  jobsForNative,
  nextToSave,
  nextWakeAt,
  reconcile,
  saveConcurrency,
  type HomeKind,
} from '../downloads/pipeline';
import { classifyFailure, planRetry } from '../downloads/retry';
import { saveDownloaded } from '../downloads/save';
import type { DownloadJob, JobStatus, NativePending, NativeResult } from '../downloads/types';
import { t, useI18n } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { Downloader, listPlaylistOnPhone } from '../native/downloader';
import { isNative } from '../native/platform';
import { useSetup } from './setup';
import { toast } from './ui';

/**
 * YouTube downloads on the phone.
 *
 * The phone's native queue downloads the audio (Opus, kept as-is) even with the
 * app closed. This store is the orchestrator: it hands jobs to that queue, and
 * saves each finished file to where the library lives (this phone, Drive or
 * Cloudflare), retrying by itself when the connection fails.
 */

export type { DownloadJob, JobStatus, NewDownload };
export { friendlyError };

const ENGINE_KEY = 'downloader-engine';
const ENGINE_MAX_AGE = 7 * 24 * 3600 * 1000;

export const useDownloads = create<DownloadsState>((set, get) => {
  let listening = false;
  let watchingVisibility = false;
  let wakeTimer: ReturnType<typeof setTimeout> | undefined;
  /** Set when a save failed for lack of internet: no more attempts until `resume()`. */
  let saveBlocked = false;
  let nativeWaiting = false;
  let hadWork = false;
  /** Jobs whose download finished while the app was closed. */
  const finishedWhileClosed = new Set<string>();

  const update = (id: string, patch: Partial<DownloadJob>) => {
    const jobs = get().jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
    set({ jobs });
    persist(jobs);
  };

  const homeKind = (): HomeKind => useSetup.getState().config?.home ?? 'device';

  async function ensureEngine() {
    const { engine } = get();
    if (engine.status === 'ready' && Date.now() - engine.updatedAt < ENGINE_MAX_AGE) return;
    if (engine.status !== 'ready') {
      set({ engine: { ...get().engine, status: 'starting', error: undefined } });
      const { version } = await Downloader.init();
      set({ engine: { ...get().engine, status: 'ready', version } });
    }
    // The yt-dlp inside the app ages fast (YouTube changes often): refresh weekly.
    if (Date.now() - get().engine.updatedAt > ENGINE_MAX_AGE) await get().updateEngine(false);
  }

  /** Tells the computer how a "Send to phone" item ended, once all its songs finished. */
  async function reportSend(sendId: string) {
    const outcome = sendOutcome(get().jobs.filter((j) => j.sendId === sendId));
    if (outcome)
      await api.sendUpdate(sendId, outcome.status, outcome.detail).catch(() => undefined);
  }

  const warn = (what: string) => (err: unknown) => console.warn(what, err);
  const { notify, templates } = createDownloadNotifier({
    getJobs: () => get().jobs,
    getWaitingNetwork: () => get().waitingNetwork,
  });

  /** Hands the queued jobs the phone does not know yet to its own queue. */
  async function sendToNative() {
    const pending = await Downloader.pending().catch(() => null);
    const jobs = jobsForNative(get().jobs, knownToNative(pending));
    if (!jobs.length) {
      // Android may have stopped the service (onTimeout): an empty queue call restarts it.
      if (pending && (pending.queued.length > 0 || pending.current)) {
        await Downloader.queue({ jobs: [], texts: templates() }).catch(() => undefined);
      }
      return;
    }
    try {
      await ensureEngine();
    } catch (err) {
      // The phone reports `init_failed` per job; the engine panel shows the detail.
      set({ engine: { ...get().engine, status: 'error', error: String((err as Error).message) } });
    }
    try {
      await Downloader.queue({ jobs, texts: templates() });
    } catch (err) {
      toast(friendlyError(String((err as Error).message ?? err)), 'error');
    }
  }

  /** What the phone reports for a job: the audio is ready, or it failed for good. */
  function applyResult(result: NativeResult) {
    const job = get().jobs.find((j) => j.id === result.jobId);
    if (!job || (job.status !== 'queued' && job.status !== 'downloading')) {
      void Downloader.ack({ jobId: result.jobId }).catch(() => undefined);
      return;
    }
    if (result.ok && result.path && result.info) {
      update(job.id, downloadedPatch(job, result, result.path, result.info));
      return;
    }
    const canceled = result.code === 'canceled';
    if (result.code === 'init_failed') {
      set({ engine: { ...get().engine, status: 'error', error: result.error } });
    }
    const raw = result.code === 'network' ? 'network' : (result.error ?? '');
    update(job.id, endedPatch(canceled, raw));
    void Downloader.ack({ jobId: result.jobId }).catch(() => undefined);
    if (job.sendId) void reportSend(job.sendId);
  }

  function scheduleWake() {
    if (wakeTimer) clearTimeout(wakeTimer);
    wakeTimer = undefined;
    const now = Date.now();
    const wake = nextWakeAt(get().jobs, now);
    if (wake !== null) wakeTimer = setTimeout(pump, Math.max(0, wake - now));
  }

  /** Cancels one active job on the phone and marks it; imports are settled by the caller. */
  async function cancelOne(jobId: string) {
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job || !isActive(job) || job.status === 'saving') return;
    if (job.status === 'downloaded') await Downloader.ack({ jobId }).catch(() => undefined);
    else await Downloader.cancel({ jobId }).catch(() => undefined);
    update(jobId, { status: 'canceled', finishedAt: Date.now() });
    if (job.sendId) void reportSend(job.sendId);
    void notify();
  }

  /** Flushes pending playlist syncs, then forgets finished imports; tells the user on failure. */
  async function settleAndReport() {
    try {
      await settleImports(() => get().jobs);
    } catch {
      toast(t('dl.err.generic'), 'error');
    }
  }

  /** The queue just emptied: sync playlists and tell the user how it went. */
  function finishQueue() {
    hadWork = false;
    // Flush before pruning: pruning drops the finished imports the flush still needs.
    void flushImportSync()
      .then(() => pruneImports(get().jobs))
      .catch(() => toast(t('dl.err.generic'), 'error'));
    const { ok, late } = finishCounts(get().jobs, finishedWhileClosed, Date.now());
    finishedWhileClosed.clear();
    if (ok) toast(t('dl.allDone', { count: ok }));
    if (late) toast(t('dl.savedAfterClose', { count: late }));
  }

  function pump() {
    if (!saveBlocked) {
      const home = homeKind();
      for (
        let job = nextToSave(get().jobs, Date.now(), new Set(get().saving));
        job && get().saving.length < saveConcurrency(home);
        job = nextToSave(get().jobs, Date.now(), new Set(get().saving))
      ) {
        void saveJob(job, home);
      }
    }
    scheduleWake();
    if (hadWork && !get().jobs.some(isActive)) finishQueue();
  }

  /** A save failed: wait for internet, try again later, or give up. */
  function handleSaveFailure(job: DownloadJob, err: unknown) {
    const kind = classifyFailure(err);
    if (kind === 'network') {
      const plan = planRetry(job.attempts ?? 0, Date.now(), navigator.onLine);
      if (plan.action === 'wait-network') {
        saveBlocked = true;
        set({ waitingNetwork: true });
        update(job.id, { status: 'downloaded', retryAt: undefined });
        return;
      }
      if (plan.action === 'retry') {
        update(job.id, { status: 'downloaded', attempts: plan.attempts, retryAt: plan.retryAt });
        return;
      }
    }
    const canceled = kind === 'canceled';
    update(job.id, endedPatch(canceled, saveErrorText(err)));
    void Downloader.ack({ jobId: job.id }).catch(() => undefined);
    if (job.sendId) void reportSend(job.sendId);
  }

  async function saveJob(job: DownloadJob, home: HomeKind) {
    hadWork = true;
    set({ saving: [...get().saving, job.id] });
    update(job.id, { status: 'saving', error: undefined });
    void notify();
    try {
      if (!job.file) throw new Error('The downloaded file is missing');
      const outcome = await saveDownloaded(job, job.file, home);
      const saved = outcome.kind === 'saved';
      update(job.id, {
        status: saved ? 'done' : 'skipped',
        trackId: saved ? outcome.track.id : outcome.trackId,
        timings: saved ? { ...job.timings, ...outcome.timings } : job.timings,
        finishedAt: Date.now(),
      });
      void Downloader.ack({ jobId: job.id }).catch(() => undefined);
      scheduleImportSync(job.videoId);
      if (job.sendId) await reportSend(job.sendId);
    } catch (err) {
      handleSaveFailure(job, err);
    } finally {
      set({ saving: get().saving.filter((id) => id !== job.id) });
      void notify();
      pump();
    }
  }

  /** Results the phone holds that the app has not applied (e.g. the event was missed). */
  function applyPendingResults(pending: NativePending) {
    for (const result of pending.results) {
      const job = get().jobs.find((j) => j.id === result.jobId);
      if (!job) void Downloader.ack({ jobId: result.jobId }).catch(() => undefined);
      else if (job.status === 'queued' || job.status === 'downloading') applyResult(result);
    }
  }

  /** The final notice goes away when the user opens the app (now, or coming back to it). */
  function clearDoneOnOpen() {
    if (!watchingVisibility && typeof document !== 'undefined') {
      watchingVisibility = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') clearDoneOnOpen();
      });
    }
    void Downloader.clearDoneNotice().catch(warn('clearDoneNotice'));
  }

  function listenToNative() {
    if (listening) return;
    listening = true;
    void Downloader.addListener('progress', ({ jobId, progress }) => {
      const patch = progressPatch(
        get().jobs.find((j) => j.id === jobId),
        progress,
      );
      if (!patch) return;
      update(jobId, patch);
      void notify();
    });
    void Downloader.addListener('finished', (result) => {
      applyResult(result);
      pump();
      void notify();
    });
    void Downloader.addListener('network', ({ waiting }) => {
      nativeWaiting = waiting;
      set({ waitingNetwork: waiting || !navigator.onLine });
    });
  }

  return {
    jobs: [],
    engine: { status: 'idle', version: null, updatedAt: loadValue<number>(ENGINE_KEY, 0) },
    keepOffline: loadValue<boolean>('downloads-keep-offline', true),
    waitingNetwork: false,
    saving: [],

    async init() {
      if (!isNative) return;
      const saved = loadValue<DownloadJob[]>(STORE_KEY, []);
      // Listen first so a `finished` event fired while `pending()` runs is not lost.
      listenToNative();
      clearDoneOnOpen();
      const pending = await Downloader.pending().catch(() => null);
      const native = pending ?? { queued: [], current: null, results: [], waitingNetwork: false };
      const { jobs, finished, orphans } = reconcile(saved, native);
      set({ jobs, waitingNetwork: native.waitingNetwork });
      nativeWaiting = native.waitingNetwork;
      pruneImports(jobs);
      for (const jobId of orphans) void Downloader.ack({ jobId }).catch(() => undefined);
      for (const result of finished) {
        finishedWhileClosed.add(result.jobId);
        applyResult(result);
      }
      await sendToNative();
      pump();
      void notify();
    },

    async enqueue(items, opts = {}) {
      if (!isNative || !items.length) return 0;
      await Downloader.requestNotifications().catch(() => undefined);
      const list = opts.playlistName ? items.slice(0, LIMITS.playlistMaxTracks) : items;
      const playlistId = opts.playlistName
        ? await resolvePlaylist(opts.playlistName, opts.playlistMode ?? 'merge')
        : null;
      const fresh = buildJobs(list, {
        existing: get().jobs,
        playlistId,
        sendId: opts.sendId ?? null,
        keepOffline: get().keepOffline,
      });
      const jobs = mergeJobs(get().jobs, fresh);
      set({ jobs });
      persist(jobs);
      if (playlistId) {
        rememberImport(
          playlistId,
          list.map((i) => i.videoId),
        );
        await syncImport(playlistId);
        pruneImports(get().jobs);
      }
      const skipped = fresh.filter((j) => j.status === 'skipped').length;
      const queued = fresh.length - skipped;
      if (skipped && playlistId) toast(t('dl.alreadyHad', { count: skipped }));
      if (queued) {
        toast(t('dl.queued', { count: queued }));
        // The foreground service must start while the app is still visible.
        await sendToNative();
        void notify();
      } else if (opts.sendId) await reportSend(opts.sendId);
      return queued;
    },

    async enqueueUrl(url, sendId = null) {
      const videoId = youtubeVideoId(url);
      if (videoId) {
        return get().enqueue([{ videoId, title: videoId, author: '' }], { sendId });
      }
      if (!youtubePlaylistId(url)) throw new Error('Not a YouTube link');
      const list = await listPlaylistOnPhone(url, useI18n.getState().language);
      if (!list.entries.length) throw new Error('Empty or private playlist');
      return get().enqueue(
        list.entries.map((e) => ({ videoId: e.id, title: e.title, author: e.author })),
        // Nobody is looking at the phone to answer: a repeated name gets "Name (n)".
        { playlistName: list.title || undefined, playlistMode: 'new', sendId },
      );
    },

    async cancel(jobId) {
      await cancelOne(jobId);
      await settleAndReport();
    },

    async cancelAll() {
      for (const job of get().jobs.filter(isActive)) await cancelOne(job.id);
      await settleAndReport();
    },

    retry(jobId) {
      const batchId = batchForRetry(get().jobs, Date.now());
      update(jobId, requeuePatch(batchId));
      void get().resume();
    },

    retryFailed() {
      const batchId = batchForRetry(get().jobs, Date.now());
      for (const j of get().jobs.filter((x) => x.status === 'error')) {
        update(j.id, requeuePatch(batchId));
      }
      void get().resume();
    },

    async clearFinished() {
      const jobs = get().jobs.filter(isActive);
      set({ jobs });
      persist(jobs);
      await settleAndReport();
    },

    setKeepOffline(keepOffline) {
      savePref('downloads-keep-offline', keepOffline);
      set({ keepOffline });
    },

    async updateEngine(manual = true) {
      if (!isNative) return;
      const prev = get().engine;
      set({ engine: { ...prev, status: 'updating', error: undefined } });
      try {
        if (prev.status !== 'ready') await Downloader.init();
        const { updated, version } = await Downloader.updateEngine();
        const now = Date.now();
        savePref(ENGINE_KEY, now);
        set({ engine: { status: 'ready', version, updatedAt: now } });
        if (manual) toast(updated ? t('dl.engineUpdated', { version }) : t('dl.engineCurrent'));
      } catch (err) {
        set({ engine: engineAfterFailure(prev, err) });
        if (manual) toast(t('dl.engineUpdateFailed'), 'error');
      }
    },

    async resume() {
      if (!isNative) return;
      if (navigator.onLine) saveBlocked = false;
      const hasWork = get().jobs.some(isActive);
      set({ waitingNetwork: hasWork && (!navigator.onLine || nativeWaiting) });
      const pending = await Downloader.pending().catch(() => null);
      if (pending) applyPendingResults(pending);
      await sendToNative();
      pump();
      void notify();
    },
  };
});
