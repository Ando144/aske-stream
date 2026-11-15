import { create } from 'zustand';
import { Capacitor } from '@capacitor/core';
import { LIMITS } from '@aske/shared';
import { metadataFromYoutube, youtubePlaylistId, youtubeVideoId } from '@aske/shared/youtube';
import { api, ApiError } from '../api/client';
import { t } from '../i18n';
import { squareJpeg } from '../lib/cover';
import { loadValue, savePref } from '../lib/storage';
import { Downloader } from '../native/downloader';
import { isNative } from '../native/platform';
import { deleteDeviceFile, saveDeviceFile } from '../storage/deviceFiles';
import { deviceHome, fromRemote, newLocalId } from '../storage/homes';
import type { LocalTrack } from '../storage/types';
import { useLibrary } from './library';
import { useOffline } from './offline';
import { useSetup } from './setup';
import { toast } from './ui';

/**
 * YouTube downloads on the phone.
 *
 * Every song is a job in a queue that survives closing the app. One job at a
 * time: yt-dlp downloads the audio (Opus, kept as-is, no re-encoding), the
 * cover is cut to a square, and the song goes to where this library lives:
 * the phone itself, or the owner's Cloudflare (optionally keeping a copy on
 * the phone to listen without internet).
 */

export type JobStatus =
  'queued' | 'downloading' | 'saving' | 'done' | 'skipped' | 'error' | 'canceled';

export interface DownloadJob {
  id: string;
  videoId: string;
  title: string;
  author: string;
  thumbnail: string;
  status: JobStatus;
  /** 0–100 while downloading. */
  progress: number;
  error?: string;
  /** Library playlist the song is added to when it is ready. */
  playlistId?: string | null;
  /** "Send to phone" item this job comes from. */
  sendId?: string | null;
  /** Cloudflare library: also keep the file on this phone. */
  keepOffline: boolean;
  trackId?: string;
  createdAt: number;
  finishedAt?: number;
}

export interface NewDownload {
  videoId: string;
  title: string;
  author: string;
  thumbnail?: string;
}

type EngineStatus = 'idle' | 'starting' | 'updating' | 'ready' | 'error';

interface DownloadsState {
  jobs: DownloadJob[];
  running: boolean;
  engine: { status: EngineStatus; version: string | null; updatedAt: number; error?: string };
  keepOffline: boolean;
  init: () => Promise<void>;
  enqueue: (
    items: NewDownload[],
    opts?: { playlistName?: string; sendId?: string | null },
  ) => Promise<number>;
  /** Expands a YouTube link (song or playlist) and queues it. */
  enqueueUrl: (url: string, sendId?: string | null) => Promise<number>;
  cancel: (jobId: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  retry: (jobId: string) => void;
  retryFailed: () => void;
  clearFinished: () => void;
  setKeepOffline: (keep: boolean) => void;
  updateEngine: (manual?: boolean) => Promise<void>;
  run: () => Promise<void>;
}

const STORE_KEY = 'downloads-v1';
const ENGINE_KEY = 'downloader-engine';
const ENGINE_MAX_AGE = 7 * 24 * 3600 * 1000;
const KEEP_FINISHED = 300;

const isActive = (j: DownloadJob) =>
  j.status === 'queued' || j.status === 'downloading' || j.status === 'saving';
const isFinished = (j: DownloadJob) => !isActive(j);

/** Turns yt-dlp's English errors into something the user can act on. */
export function friendlyError(raw: string): string {
  const m = raw.toLowerCase();
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

function mimeFor(ext: string): string {
  if (ext === 'webm' || ext === 'weba') return 'audio/webm';
  if (ext === 'm4a' || ext === 'mp4') return 'audio/mp4';
  return 'audio/ogg';
}

async function readNativeFile(path: string): Promise<Blob> {
  const res = await fetch(Capacitor.convertFileSrc(path));
  if (!res.ok) throw new Error(`Could not read the downloaded file (${res.status})`);
  return res.blob();
}

async function fetchCover(job: DownloadJob): Promise<{ blob: Blob | null; paths: string[] }> {
  const paths: string[] = [];
  for (const name of ['maxresdefault', 'hqdefault']) {
    try {
      const { path } = await Downloader.fetchImage({
        url: `https://i.ytimg.com/vi/${job.videoId}/${name}.jpg`,
        jobId: job.id,
      });
      paths.push(path);
      const square = await squareJpeg(await readNativeFile(path));
      if (square && square.size <= LIMITS.coverMaxBytes) return { blob: square, paths };
    } catch {
      // try the next size
    }
  }
  return { blob: null, paths };
}

function findInLibrary(videoId: string): LocalTrack | undefined {
  const { tracks } = useLibrary.getState();
  return Object.values(tracks).find((tr) => tr.source === 'youtube' && tr.sourceRef === videoId);
}

export const useDownloads = create<DownloadsState>((set, get) => {
  const update = (id: string, patch: Partial<DownloadJob>) => {
    const jobs = get().jobs.map((j) => (j.id === id ? { ...j, ...patch } : j));
    set({ jobs });
    persist(jobs);
  };

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
    const current = active.find((j) => j.status !== 'queued') ?? active[0]!;
    const batch = jobs.filter((j) => j.createdAt >= (active[active.length - 1]?.createdAt ?? 0));
    const done = batch.filter(isFinished).length;
    await Downloader.setNotification({
      active: true,
      title: t('dl.notifTitle'),
      text: t('dl.notifText', { done: done + 1, total: batch.length, title: current.title }),
      progress: Math.round(current.progress),
    }).catch(() => undefined);
  }

  async function process(job: DownloadJob) {
    const existing = findInLibrary(job.videoId);
    if (existing) {
      if (job.playlistId)
        await useLibrary.getState().addToPlaylist(job.playlistId, [existing.id], true);
      update(job.id, { status: 'skipped', trackId: existing.id, finishedAt: Date.now() });
      return;
    }

    await ensureEngine();
    update(job.id, { status: 'downloading', progress: 0, error: undefined });
    void notify();
    const result = await Downloader.download({ jobId: job.id, videoId: job.videoId });
    update(job.id, { status: 'saving', progress: 100 });
    const cleanup = [result.path];
    try {
      const meta = metadataFromYoutube({ ...result.info, id: job.videoId });
      const durationMs = Math.round((result.info.duration ?? 0) * 1000);
      if (durationMs <= 0) throw new Error('Unknown duration');
      const mime = mimeFor(result.ext);
      const audio = new File([await readNativeFile(result.path)], `${job.videoId}.${result.ext}`, {
        type: mime,
      });
      const cover = await fetchCover(job);
      cleanup.push(...cover.paths);
      const bitrateKbps =
        Math.round(result.info.abr ?? 0) || Math.round((audio.size * 8) / durationMs) || null;
      const home = useSetup.getState().config?.home;
      let track: LocalTrack;

      if (home === 'cloudflare') {
        if (mime === 'audio/mp4') throw new Error('Only Opus audio can be stored in Cloudflare');
        if (!navigator.onLine) throw new ApiError(0, 'network_error', 'No connection');
        const form = new FormData();
        form.append(
          'meta',
          JSON.stringify({
            title: meta.title.slice(0, LIMITS.titleMax) || job.title,
            artist: meta.artist.slice(0, LIMITS.titleMax),
            album: meta.album.slice(0, LIMITS.titleMax),
            durationMs,
            bitrateKbps,
            source: 'youtube',
            sourceRef: job.videoId,
            kind: 'music',
          }),
        );
        form.append('audio', audio);
        if (cover.blob)
          form.append('cover', new File([cover.blob], 'cover.jpg', { type: 'image/jpeg' }));
        try {
          track = fromRemote(await api.uploadTrack(form));
        } catch (err) {
          if (err instanceof ApiError && err.status === 409) {
            await useLibrary.getState().load();
            const dup = findInLibrary(job.videoId);
            if (job.playlistId && dup)
              await useLibrary.getState().addToPlaylist(job.playlistId, [dup.id], true);
            update(job.id, { status: 'skipped', trackId: dup?.id, finishedAt: Date.now() });
            return;
          }
          throw err;
        }
        useLibrary.getState().upsertTracks([track]);
        if (job.keepOffline) await useOffline.getState().adopt(track.id, audio, durationMs);
      } else {
        const id = newLocalId();
        try {
          await saveDeviceFile('audio', id, audio);
          if (cover.blob) await saveDeviceFile('covers', id, cover.blob);
          track = await deviceHome.addTrack({
            id,
            title: meta.title || job.title,
            artist: meta.artist,
            album: meta.album,
            durationMs,
            sizeBytes: audio.size,
            bitrateKbps,
            hasCover: !!cover.blob,
            kind: 'music',
            source: 'youtube',
            sourceRef: job.videoId,
            likedAt: null,
            createdAt: Date.now(),
            locations: { device: true },
            mime,
          });
        } catch (err) {
          await deleteDeviceFile('audio', id).catch(() => undefined);
          await deleteDeviceFile('covers', id).catch(() => undefined);
          throw err;
        }
        useLibrary.getState().upsertTracks([track]);
      }

      if (job.playlistId)
        await useLibrary.getState().addToPlaylist(job.playlistId, [track.id], true);
      update(job.id, { status: 'done', trackId: track.id, finishedAt: Date.now() });
    } finally {
      for (const path of cleanup) await Downloader.deleteFile({ path }).catch(() => undefined);
    }
  }

  return {
    jobs: [],
    running: false,
    engine: { status: 'idle', version: null, updatedAt: loadValue<number>(ENGINE_KEY, 0) },
    keepOffline: loadValue<boolean>('downloads-keep-offline', true),

    async init() {
      if (!isNative) return;
      const saved = loadValue<DownloadJob[]>(STORE_KEY, []);
      // Interrupted when the app closed: start those again from the beginning.
      const jobs = saved.map((j) =>
        j.status === 'downloading' || j.status === 'saving'
          ? { ...j, status: 'queued' as const, progress: 0 }
          : j,
      );
      set({ jobs });
      await Downloader.clearAll().catch(() => undefined);
      void Downloader.addListener('progress', ({ jobId, progress }) => {
        const job = get().jobs.find((j) => j.id === jobId);
        if (!job || job.status !== 'downloading') return;
        if (Math.abs(progress - job.progress) < 1 && progress < 100) return;
        update(jobId, { progress: Math.max(0, Math.min(100, progress)) });
        void notify();
      });
      if (jobs.some((j) => j.status === 'queued')) void get().run();
    },

    async enqueue(items, opts = {}) {
      if (!isNative || !items.length) return 0;
      await Downloader.requestNotifications().catch(() => undefined);
      let playlistId: string | null = null;
      if (opts.playlistName) {
        const name = opts.playlistName.slice(0, LIMITS.nameMax);
        const existing = useLibrary.getState().playlists.find((p) => p.name === name);
        playlistId = existing?.id ?? (await useLibrary.getState().createPlaylist(name))?.id ?? null;
      }
      const queuedIds = new Set(
        get()
          .jobs.filter(isActive)
          .map((j) => j.videoId),
      );
      const now = Date.now();
      const fresh: DownloadJob[] = [];
      for (const [i, item] of items.entries()) {
        if (queuedIds.has(item.videoId)) continue;
        queuedIds.add(item.videoId);
        fresh.push({
          id: `${now.toString(36)}-${i}-${item.videoId}`.replace(/[^\w-]/g, ''),
          videoId: item.videoId,
          title: item.title || item.videoId,
          author: item.author,
          thumbnail: item.thumbnail ?? `https://i.ytimg.com/vi/${item.videoId}/hqdefault.jpg`,
          status: 'queued',
          progress: 0,
          playlistId,
          sendId: opts.sendId ?? null,
          keepOffline: get().keepOffline,
          createdAt: now + i,
        });
      }
      const finished = get().jobs.filter(isFinished).slice(-KEEP_FINISHED);
      const jobs = [...get().jobs.filter(isActive), ...fresh, ...finished].sort(
        (a, b) => a.createdAt - b.createdAt,
      );
      set({ jobs });
      persist(jobs);
      if (fresh.length) {
        toast(t('dl.queued', { count: fresh.length }));
        void get().run();
      }
      return fresh.length;
    },

    async enqueueUrl(url, sendId = null) {
      const videoId = youtubeVideoId(url);
      if (videoId) {
        return get().enqueue([{ videoId, title: videoId, author: '' }], { sendId });
      }
      if (!youtubePlaylistId(url)) throw new Error('Not a YouTube link');
      await ensureEngine();
      const list = await Downloader.list({ url });
      return get().enqueue(
        list.entries.map((e) => ({ videoId: e.id, title: e.title, author: e.uploader })),
        { playlistName: list.title || undefined, sendId },
      );
    },

    async cancel(jobId) {
      const job = get().jobs.find((j) => j.id === jobId);
      if (!job || !isActive(job)) return;
      if (job.status !== 'queued') await Downloader.cancel({ jobId }).catch(() => undefined);
      update(jobId, { status: 'canceled', finishedAt: Date.now() });
      if (job.sendId) void reportSend(job.sendId);
      void notify();
    },

    async cancelAll() {
      for (const job of get().jobs.filter(isActive)) await get().cancel(job.id);
    },

    retry(jobId) {
      update(jobId, { status: 'queued', progress: 0, error: undefined, finishedAt: undefined });
      void get().run();
    },

    retryFailed() {
      for (const j of get().jobs.filter((x) => x.status === 'error')) {
        update(j.id, { status: 'queued', progress: 0, error: undefined, finishedAt: undefined });
      }
      void get().run();
    },

    clearFinished() {
      const jobs = get().jobs.filter(isActive);
      set({ jobs });
      persist(jobs);
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

    async run() {
      if (!isNative || get().running) return;
      set({ running: true });
      try {
        let job: DownloadJob | undefined;
        while ((job = get().jobs.find((j) => j.status === 'queued'))) {
          try {
            await process(job);
          } catch (err) {
            const current = get().jobs.find((j) => j.id === job!.id);
            if (current?.status === 'canceled') continue;
            const code = (err as { code?: string }).code;
            const raw = String((err as Error).message ?? err);
            update(job.id, {
              status: code === 'canceled' ? 'canceled' : 'error',
              error: code === 'canceled' ? undefined : friendlyError(raw),
              finishedAt: Date.now(),
            });
            if (code === 'init_failed') {
              set({ engine: { ...get().engine, status: 'error', error: raw } });
            }
          }
          if (job.sendId) await reportSend(job.sendId);
          void notify();
        }
        const finished = get().jobs.filter(
          (j) => j.finishedAt && Date.now() - j.finishedAt < 60_000,
        );
        const ok = finished.filter((j) => j.status === 'done').length;
        if (ok) toast(t('dl.allDone', { count: ok }));
      } finally {
        set({ running: false });
        void notify();
      }
    },
  };
});
