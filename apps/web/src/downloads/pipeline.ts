// Pure scheduling helpers for the download pipeline (no stores, no Capacitor).
import { LIMITS } from '@aske/shared';
import type { DownloadJob, NativeJob, NativePending, NativeResult } from './types';

export type HomeKind = 'device' | 'drive' | 'cloudflare';
export type SaveTarget = NonNullable<DownloadJob['target']>;

const SAVE_CONCURRENCY: Record<HomeKind, number> = { device: 1, drive: 2, cloudflare: 2 };

/** Above this size a cloud upload takes minutes: only one at a time, and fewer retries. */
export const BIG_AUDIO_BYTES = 30 * 1024 * 1024;

const MIN_UPLOAD_MS = 120_000;
const MAX_UPLOAD_MS = 30 * 60_000;
const SLOWEST_BYTES_PER_SECOND = 64 * 1024;
/** Margin over the upload limit before a save is considered stuck. */
const STUCK_GRACE_MS = 120_000;

export function saveConcurrency(home: HomeKind): number {
  return SAVE_CONCURRENCY[home];
}

export function uploadTimeoutMs(bytes: number): number {
  const needed = (bytes / SLOWEST_BYTES_PER_SECOND) * 1000;
  return Math.max(MIN_UPLOAD_MS, Math.min(MAX_UPLOAD_MS, needed));
}

export function saveTarget(home: HomeKind, bytes: number): SaveTarget {
  return home === 'cloudflare' && bytes > LIMITS.audioMaxBytes ? 'device-only' : 'home';
}

/** Where a job goes now: a stored 'device-only' only counts while the library is in Cloudflare. */
export function targetFor(job: DownloadJob, home: HomeKind): SaveTarget {
  if (home === 'cloudflare' && job.target === 'device-only') return 'device-only';
  return saveTarget(home, job.file?.bytes ?? 0);
}

const isBig = (job: DownloadJob) => (job.file?.bytes ?? 0) > BIG_AUDIO_BYTES;

/** Which jobs may start next to the ones already being saved. */
function freeLanes(running: readonly DownloadJob[], home: HomeKind) {
  const cloud = running.filter((j) => targetFor(j, home) === 'home');
  const phoneBusy = cloud.length < running.length;
  const bigBusy = cloud.some(isBig);
  return (job: DownloadJob) => {
    if (targetFor(job, home) === 'device-only') return !phoneBusy;
    return cloud.length < saveConcurrency(home) && !(isBig(job) && bigBusy);
  };
}

/** Oldest 'downloaded' job that has a free lane and whose retry time has come. */
export function nextToSave(
  jobs: readonly DownloadJob[],
  now: number,
  busy: ReadonlySet<string>,
  home: HomeKind,
): DownloadJob | undefined {
  const fits = freeLanes(
    jobs.filter((j) => busy.has(j.id)),
    home,
  );
  let best: DownloadJob | undefined;
  for (const job of jobs) {
    if (job.status !== 'downloaded' || busy.has(job.id) || (job.retryAt ?? 0) > now) continue;
    if (fits(job) && (!best || job.createdAt < best.createdAt)) best = job;
  }
  return best;
}

/** Ids of jobs that have been saving for longer than any healthy save would. */
export function stuckSaving(jobs: readonly DownloadJob[], now: number): string[] {
  return jobs
    .filter((j) => {
      if (j.status !== 'saving' || j.savingSince === undefined) return false;
      return now - j.savingSince > uploadTimeoutMs(j.file?.bytes ?? 0) + STUCK_GRACE_MS;
    })
    .map((j) => j.id);
}

/** Earliest future retry time among 'downloaded' jobs, or null. */
export function nextWakeAt(jobs: readonly DownloadJob[], now: number): number | null {
  let wake: number | null = null;
  for (const job of jobs) {
    if (job.status !== 'downloaded' || job.retryAt === undefined || job.retryAt <= now) continue;
    if (wake === null || job.retryAt < wake) wake = job.retryAt;
  }
  return wake;
}

/** Queued jobs the native side does not know yet. */
export function jobsForNative(
  jobs: readonly DownloadJob[],
  known: ReadonlySet<string>,
): NativeJob[] {
  return jobs
    .filter((j) => j.status === 'queued' && !known.has(j.id))
    .map((j) => ({ jobId: j.id, videoId: j.videoId, title: j.title.slice(0, 200) }));
}

const isActive = (job: DownloadJob) => job.status === 'queued' || job.status === 'downloading';

const isAwaitingSave = (job: DownloadJob) => job.status === 'downloaded' || job.status === 'saving';

function restore(job: DownloadJob, native: NativePending, hasResult: boolean): DownloadJob {
  if (job.status === 'saving') {
    return job.file ? { ...job, status: 'downloaded' } : { ...job, status: 'queued', progress: 0 };
  }
  if (job.status === 'downloading') {
    const known = hasResult || native.current === job.id || native.queued.includes(job.id);
    if (!known) return { ...job, status: 'queued', progress: 0 };
  }
  return job;
}

function withTarget(job: DownloadJob, home: HomeKind | undefined): DownloadJob {
  if (!home || job.status !== 'downloaded' || !job.file) return job;
  return { ...job, target: targetFor(job, home) };
}

/** Rebuilds the job list after the app restarts, from what the native side still has. */
export function reconcile(
  saved: readonly DownloadJob[],
  native: NativePending,
  home?: HomeKind,
): { jobs: DownloadJob[]; finished: NativeResult[]; orphans: string[] } {
  const resultIds = new Set(native.results.map((r) => r.jobId));
  const byId = new Map(saved.map((j) => [j.id, j]));
  const finished: NativeResult[] = [];
  const orphans: string[] = [];
  for (const result of native.results) {
    const job = byId.get(result.jobId);
    // Downloaded/saving jobs keep their native result until the save is acked.
    if (job && isAwaitingSave(job)) continue;
    if (job && isActive(job)) finished.push(result);
    else orphans.push(result.jobId);
  }
  const jobs = saved.map((j) => withTarget(restore(j, native, resultIds.has(j.id)), home));
  return { jobs, finished, orphans };
}
