import { create } from 'zustand';
import { LIMITS } from '@aske/shared';
import { youtubePlaylistId, youtubeVideoId } from '@aske/shared/youtube';
import { api } from '../api/client';
import { batchForRetry, notificationCounts } from '../downloads/batch';
import {
  findInLibrary,
  flushImportSync,
  pruneImports,
  rememberImport,
  resolvePlaylist,
  scheduleImportSync,
  settleImports,
  syncImport,
} from '../downloads/imports';
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
import type {
  DownloadJob,
  JobStatus,
  NativePending,
  NativeResult,
  NotificationTemplates,
} from '../downloads/types';
import { t, useI18n } from '../i18n';
import { loadValue, savePref } from '../lib/storage';
import { Downloader, listPlaylistOnPhone } from '../native/downloader';
import { isNative } from '../native/platform';
import { DriveAuthRequired } from '../storage/drive/auth';
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

export type { DownloadJob, JobStatus };

export interface NewDownload {
  videoId: string;
  title: string;
  author: string;
  thumbnail?: string;
}

type EngineStatus = 'idle' | 'starting' | 'updating' | 'ready' | 'error';

interface DownloadsState {
  jobs: DownloadJob[];
  engine: { status: EngineStatus; version: string | null; updatedAt: number; error?: string };
  keepOffline: boolean;
  /** true while the phone or the app is waiting for internet to come back. */
  waitingNetwork: boolean;
  /** jobIds being saved right now. */
  saving: string[];
  init: () => Promise<void>;
  /** Returns how many songs were really queued (songs already in the library are skipped). */
  enqueue: (
    items: NewDownload[],
    opts?: {
      playlistName?: string;
      /** Name already taken: 'merge' (default) joins that playlist, 'new' creates "Name (n)". */
      playlistMode?: 'merge' | 'new';
      sendId?: string | null;
    },
  ) => Promise<number>;
  /** Expands a YouTube link (song or playlist) and queues it. */
  enqueueUrl: (url: string, sendId?: string | null) => Promise<number>;
  cancel: (jobId: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  retry: (jobId: string) => void;
  retryFailed: () => void;
  clearFinished: () => Promise<void>;
  setKeepOffline: (keep: boolean) => void;
  updateEngine: (manual?: boolean) => Promise<void>;
  /** Re-sends queued jobs to the phone and saves what is ready (app reopened / internet back). */
  resume: () => Promise<void>;
}

const STORE_KEY = 'downloads-v1';
const ENGINE_KEY = 'downloader-engine';
const ENGINE_MAX_AGE = 7 * 24 * 3600 * 1000;
const KEEP_FINISHED = 300;

const ACTIVE: ReadonlySet<JobStatus> = new Set(['queued', 'downloading', 'downloaded', 'saving']);
const isActive = (j: DownloadJob) => ACTIVE.has(j.status);
const isFinished = (j: DownloadJob) => !isActive(j);

/** Turns yt-dlp's English errors into something the user can act on. */
export function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('storage is full') || m.includes('storage_full')) return t('dl.err.cloudFull');
  if (m.includes('drive_full')) return t('dl.err.driveFull');
  if (m.includes('drive_auth')) return t('dl.err.driveAuth');
  if (m.includes('quota') || m.includes('no space') || m.includes('enospc'))
    return t('dl.err.phoneFull');
  if (m.includes('confirm you') && m.includes('bot')) return t('dl.err.bot');
  if (m.includes('private video') || m.includes('unavailable') || m.includes('removed'))
    return t('dl.err.unavailable');
  if (m.includes('age') && m.includes('sign in')) return t('dl.err.age');
  if (m.includes('copyright') || m.includes('not available in your country'))
    return t('dl.err.blocked');
  if (
    m.includes('network') ||
    m.includes('timed out') ||
    m.includes('unable to download') ||
    m.includes('connection') ||
    m.includes('no connection')
  )
    return t('dl.err.network');
  if (m.includes('too large') || m.includes('too big')) return t('dl.err.tooBig');
  return t('dl.err.generic');
}

/** Raw text that `friendlyError` understands for a failed save. */
function saveErrorText(err: unknown): string {
  const code = (err as { code?: string }).code;
  if (code === 'drive_full' || err instanceof DriveAuthRequired) {
    return code ?? 'drive_auth';
  }
  return String((err as Error)?.message ?? err);
}

/** Saves at most every 400 ms, and never later than that (progress events are frequent). */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave: DownloadJob[] | null = null;
function persist(jobs: DownloadJob[]) {
  pendingSave = jobs;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    if (pendingSave) savePref(STORE_KEY, pendingSave);
    pendingSave = null;
  }, 400);
}

const notificationTemplates = (): NotificationTemplates => ({
  progress: t('dl.notifTitle', { done: '{done}', total: '{total}' }),
  waiting: t('dl.notifWaiting'),
  openToSave: t('dl.notifOpenToSave', { count: '{count}' }),
  openToSaveOne: t('dl.notifOpenToSave', { count: 1 }),
  paused: t('dl.notifPaused'),
});

const knownToNative = (p: NativePending | null): Set<string> =>
  new Set(
    p ? [...p.queued, ...(p.current ? [p.current] : []), ...p.results.map((r) => r.jobId)] : [],
  );

export const useDownloads = create<DownloadsState>((set, get) => {
  let listening = false;
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
    const jobs = get().jobs.filter((j) => j.sendId === sendId);
    if (jobs.some(isActive)) return;
    const ok = jobs.filter((j) => j.status === 'done' || j.status === 'skipped').length;
    const failed = jobs.filter((j) => j.status === 'error').length;
    const status = ok > 0 || failed === 0 ? 'done' : 'error';
    const detail =
      failed > 0 ? t('send.detailPartial', { ok, failed }) : t('send.detailDone', { count: ok });
    await api.sendUpdate(sendId, status, detail).catch(() => undefined);
  }

  async function notify() {
    const jobs = get().jobs;
    const active = jobs.filter(isActive);
    if (!active.length) {
      await Downloader.setNotification({ active: false }).catch(() => undefined);
      return;
    }
    const current =
      active.find((j) => j.status === 'downloading' || j.status === 'saving') ?? active[0]!;
    const counts = notificationCounts(jobs) ?? { position: 1, total: active.length };
    const left = active.length - 1;
    await Downloader.setNotification({
      active: true,
      title: t('dl.notifTitle', { done: counts.position, total: counts.total }),
      text:
        left > 0
          ? t('dl.notifText', { title: current.title, count: left })
          : t('dl.notifTextLast', { title: current.title }),
      progress: Math.round(current.progress),
    }).catch(() => undefined);
  }

  /** Jobs for new songs: queued, or already skipped when the library has them. */
  function buildJobs(items: NewDownload[], playlistId: string | null, sendId: string | null) {
    const seen = new Set(
      get()
        .jobs.filter(isActive)
        .map((j) => j.videoId),
    );
    const now = Date.now();
    const batchId = `b${now.toString(36)}`;
    const fresh: DownloadJob[] = [];
    for (const [i, item] of items.entries()) {
      if (seen.has(item.videoId)) continue;
      seen.add(item.videoId);
      const inLibrary = findInLibrary(item.videoId);
      fresh.push({
        id: `${now.toString(36)}-${i}-${item.videoId}`.replace(/[^\w-]/g, ''),
        videoId: item.videoId,
        title: item.title || item.videoId,
        author: item.author,
        thumbnail: item.thumbnail ?? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
        status: inLibrary ? 'skipped' : 'queued',
        progress: 0,
        playlistId,
        batchId,
        sendId,
        keepOffline: get().keepOffline,
        trackId: inLibrary?.id,
        createdAt: now + i,
        finishedAt: inLibrary ? now : undefined,
      });
    }
    return fresh;
  }

  /** Hands the queued jobs the phone does not know yet to its own queue. */
  async function sendToNative() {
    const pending = await Downloader.pending().catch(() => null);
    const jobs = jobsForNative(get().jobs, knownToNative(pending));
    if (!jobs.length) {
      // Android may have stopped the service (onTimeout): an empty queue call restarts it.
      if (pending && (pending.queued.length > 0 || pending.current)) {
        await Downloader.queue({ jobs: [], texts: notificationTemplates() }).catch(() => undefined);
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
      await Downloader.queue({ jobs, texts: notificationTemplates() });
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
      update(job.id, {
        status: 'downloaded',
        progress: 100,
        error: undefined,
        file: {
          path: result.path,
          bytes: result.bytes ?? 0,
          ext: result.ext ?? 'webm',
          info: result.info,
        },
        timings: { ...job.timings, downloadMs: result.elapsedMs },
      });
      return;
    }
    const canceled = result.code === 'canceled';
    if (result.code === 'init_failed') {
      set({ engine: { ...get().engine, status: 'error', error: result.error } });
    }
    const raw = result.code === 'network' ? 'network' : (result.error ?? '');
    update(job.id, {
      status: canceled ? 'canceled' : 'error',
      error: canceled ? undefined : friendlyError(raw),
      finishedAt: Date.now(),
    });
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
    const recent = get().jobs.filter((j) => j.finishedAt && Date.now() - j.finishedAt < 60_000);
    const ok = recent.filter((j) => j.status === 'done').length;
    if (ok) toast(t('dl.allDone', { count: ok }));
    const late = [...finishedWhileClosed].filter(
      (id) => get().jobs.find((j) => j.id === id)?.status === 'done',
    ).length;
    finishedWhileClosed.clear();
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
    update(job.id, {
      status: canceled ? 'canceled' : 'error',
      error: canceled ? undefined : friendlyError(saveErrorText(err)),
      finishedAt: Date.now(),
    });
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

  function listenToNative() {
    if (listening) return;
    listening = true;
    void Downloader.addListener('progress', ({ jobId, progress }) => {
      const job = get().jobs.find((j) => j.id === jobId);
      if (!job || (job.status !== 'downloading' && job.status !== 'queued')) return;
      if (job.status === 'downloading' && Math.abs(progress - job.progress) < 1 && progress < 100)
        return;
      update(jobId, { status: 'downloading', progress: Math.max(0, Math.min(100, progress)) });
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
      const fresh = buildJobs(list, playlistId, opts.sendId ?? null);
      const finished = get().jobs.filter(isFinished).slice(-KEEP_FINISHED);
      const jobs = [...get().jobs.filter(isActive), ...fresh, ...finished].sort(
        (a, b) => a.createdAt - b.createdAt,
      );
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
      update(jobId, {
        status: 'queued',
        progress: 0,
        error: undefined,
        finishedAt: undefined,
        attempts: 0,
        retryAt: undefined,
        batchId,
      });
      void get().resume();
    },

    retryFailed() {
      const batchId = batchForRetry(get().jobs, Date.now());
      for (const j of get().jobs.filter((x) => x.status === 'error')) {
        update(j.id, {
          status: 'queued',
          progress: 0,
          error: undefined,
          finishedAt: undefined,
          attempts: 0,
          retryAt: undefined,
          batchId,
        });
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
        set({
          engine: {
            ...prev,
            status: prev.version ? 'ready' : 'error',
            error: String((err as Error).message ?? err),
          },
        });
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
