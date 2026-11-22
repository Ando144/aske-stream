// Pure scheduling helpers for the download pipeline (no stores, no Capacitor).
import type { DownloadJob, NativeJob, NativePending, NativeResult } from './types';

export type HomeKind = 'device' | 'drive' | 'cloudflare';

const SAVE_CONCURRENCY: Record<HomeKind, number> = { device: 1, drive: 2, cloudflare: 2 };

export function saveConcurrency(home: HomeKind): number {
  return SAVE_CONCURRENCY[home];
}

/** Oldest 'downloaded' job that is not being saved and whose retry time has come. */
export function nextToSave(
  jobs: readonly DownloadJob[],
  now: number,
  busy: ReadonlySet<string>,
): DownloadJob | undefined {
  let best: DownloadJob | undefined;
  for (const job of jobs) {
    if (job.status !== 'downloaded' || busy.has(job.id) || (job.retryAt ?? 0) > now) continue;
    if (!best || job.createdAt < best.createdAt) best = job;
  }
  return best;
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

/** Rebuilds the job list after the app restarts, from what the native side still has. */
export function reconcile(
  saved: readonly DownloadJob[],
  native: NativePending,
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
  const jobs = saved.map((j) => restore(j, native, resultIds.has(j.id)));
  return { jobs, finished, orphans };
}
