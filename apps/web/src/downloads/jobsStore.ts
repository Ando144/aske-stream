import { t } from '../i18n';
import { friendlyError } from './errors';
import { savePref } from '../lib/storage';
import { findInLibrary } from './imports';
import type { DownloadJob, JobStatus, NativePending, NativeResult } from './types';

export interface NewDownload {
  videoId: string;
  title: string;
  author: string;
  thumbnail?: string;
}

export type EngineStatus = 'idle' | 'starting' | 'updating' | 'ready' | 'error';

export interface DownloadsState {
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
      /** The caller shows its own notice: skip the "added to the queue" one. */
      quiet?: boolean;
    },
  ) => Promise<number>;
  /** Expands a YouTube link (song or playlist) and queues it. */
  enqueueUrl: (url: string, sendId?: string | null) => Promise<number>;
  cancel: (jobId: string) => Promise<void>;
  cancelAll: () => Promise<void>;
  retry: (jobId: string) => void;
  retryFailed: () => void;
  /** Forgets a failed or canceled job, and its file on the phone. */
  remove: (jobId: string) => Promise<void>;
  clearFinished: () => Promise<void>;
  setKeepOffline: (keep: boolean) => void;
  updateEngine: (manual?: boolean) => Promise<void>;
  /** Re-sends queued jobs to the phone and saves what is ready (app reopened / internet back). */
  resume: () => Promise<void>;
}

export const STORE_KEY = 'downloads-v1';
export const KEEP_FINISHED = 300;

const ACTIVE: ReadonlySet<JobStatus> = new Set(['queued', 'downloading', 'downloaded', 'saving']);
export const isActive = (j: DownloadJob) => ACTIVE.has(j.status);
export const isFinished = (j: DownloadJob) => !isActive(j);

/** Saves at most every 400 ms, and never later than that (progress events are frequent). */
let saveTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSave: DownloadJob[] | null = null;
export function persist(jobs: DownloadJob[]) {
  pendingSave = jobs;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    if (pendingSave) savePref(STORE_KEY, pendingSave);
    pendingSave = null;
  }, 400);
}

export const requeuePatch = (batchId: string): Partial<DownloadJob> => ({
  status: 'queued',
  progress: 0,
  error: undefined,
  finishedAt: undefined,
  attempts: 0,
  retryAt: undefined,
  serverFailures: undefined,
  savingSince: undefined,
  target: undefined,
  batchId,
  // The Worker keeps rejecting the id of a canceled upload for 30 days.
  uploadId: crypto.randomUUID(),
});

export const knownToNative = (p: NativePending | null): Set<string> =>
  new Set(
    p ? [...p.queued, ...(p.current ? [p.current] : []), ...p.results.map((r) => r.jobId)] : [],
  );

interface BuildContext {
  existing: readonly DownloadJob[];
  playlistId: string | null;
  sendId: string | null;
  keepOffline: boolean;
}

/** Jobs for new songs: queued, or already skipped when the library has them. */
export function buildJobs(items: NewDownload[], ctx: BuildContext): DownloadJob[] {
  const seen = new Set(ctx.existing.filter(isActive).map((j) => j.videoId));
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
      playlistId: ctx.playlistId,
      batchId,
      sendId: ctx.sendId,
      keepOffline: ctx.keepOffline,
      trackId: inLibrary?.id,
      createdAt: now + i,
      finishedAt: inLibrary ? now : undefined,
    });
  }
  return fresh;
}

/** How a "Send to phone" item ended, or null while some of its songs are still active. */
export function sendOutcome(
  jobs: readonly DownloadJob[],
): { status: 'done' | 'error'; detail: string } | null {
  if (jobs.some(isActive)) return null;
  const ok = jobs.filter((j) => j.status === 'done' || j.status === 'skipped').length;
  const failed = jobs.filter((j) => j.status === 'error').length;
  return {
    status: ok > 0 || failed === 0 ? 'done' : 'error',
    detail:
      failed > 0 ? t('send.detailPartial', { ok, failed }) : t('send.detailDone', { count: ok }),
  };
}

/** What a job looks like once the phone reports its audio is ready. */
export function downloadedPatch(
  job: DownloadJob,
  result: NativeResult,
  path: string,
  info: NonNullable<NativeResult['info']>,
): Partial<DownloadJob> {
  return {
    status: 'downloaded',
    progress: 100,
    error: undefined,
    file: {
      path,
      bytes: result.bytes ?? 0,
      ext: result.ext ?? 'webm',
      info,
    },
    timings: { ...job.timings, downloadMs: result.elapsedMs },
  };
}

/** Songs saved in the last minute, and those that finished while the app was closed. */
export function finishCounts(
  jobs: readonly DownloadJob[],
  closedIds: ReadonlySet<string>,
  now: number,
): { ok: number; late: number } {
  const ok = jobs.filter((j) => j.finishedAt && now - j.finishedAt < 60_000 && j.status === 'done');
  const late = [...closedIds].filter((id) => jobs.find((j) => j.id === id)?.status === 'done');
  return { ok: ok.length, late: late.length };
}

/** Active jobs and new ones, plus the most recent finished ones, oldest first. */
export function mergeJobs(current: readonly DownloadJob[], fresh: DownloadJob[]): DownloadJob[] {
  const finished = current.filter(isFinished).slice(-KEEP_FINISHED);
  return [...current.filter(isActive), ...fresh, ...finished].sort(
    (a, b) => a.createdAt - b.createdAt,
  );
}

/** The change a progress event causes, or null when it is not worth applying. */
export function progressPatch(
  job: DownloadJob | undefined,
  progress: number,
): Partial<DownloadJob> | null {
  if (!job || (job.status !== 'downloading' && job.status !== 'queued')) return null;
  if (job.status === 'downloading' && Math.abs(progress - job.progress) < 1 && progress < 100) {
    return null;
  }
  return { status: 'downloading', progress: Math.max(0, Math.min(100, progress)) };
}

/** A job that stopped for good: canceled by the user, or failed with a readable reason. */
export function endedPatch(canceled: boolean, rawError: string): Partial<DownloadJob> {
  return {
    status: canceled ? 'canceled' : 'error',
    error: canceled ? undefined : friendlyError(rawError),
    finishedAt: Date.now(),
  };
}

/** Engine state after a failed update: keep using the old version when there is one. */
export function engineAfterFailure(prev: DownloadsState['engine'], err: unknown) {
  return {
    ...prev,
    status: (prev.version ? 'ready' : 'error') as EngineStatus,
    error: String((err as Error).message ?? err),
  };
}
