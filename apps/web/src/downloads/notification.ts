// Content of the download notification (no stores, no Capacitor).
import { batchCompleted, notificationCounts } from './batch';
import type { DownloadJob } from './types';

export type Translate = (key: string, params?: Record<string, string | number>) => string;

export interface NotificationContent {
  title: string;
  text: string;
  progress: number;
}

export interface SentNotification {
  content: NotificationContent;
  at: number;
}

export const PROGRESS_MIN_GAP_MS = 1000;
/** Resend an unchanged notice this often so the native service never sees JS as silent (10 s). */
export const HEARTBEAT_MS = 5000;

const ACTIVE = new Set(['queued', 'downloading', 'downloaded', 'saving']);

/** Total progress of the batch, 0-100: finished songs plus the fraction of the current one. */
export function batchProgress(finished: number, fraction: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.floor(((finished + fraction) / total) * 100));
}

function currentJob(active: readonly DownloadJob[]): DownloadJob {
  return (
    active.find((j) => j.status === 'downloading') ??
    active.find((j) => j.status === 'saving') ??
    active[0]!
  );
}

function fractionOf(job: DownloadJob, waitingNetwork: boolean): number {
  if (waitingNetwork) return 0;
  if (job.status === 'saving' || job.status === 'downloaded') return 1;
  return Math.min(1, Math.max(0, job.progress / 100));
}

/** null when nothing is active. */
export function buildNotification(
  jobs: readonly DownloadJob[],
  waitingNetwork: boolean,
  t: Translate,
  floor = 0,
): NotificationContent | null {
  const active = jobs.filter((j) => ACTIVE.has(j.status));
  if (!active.length) return null;
  const current = currentJob(active);
  const { total } = notificationCounts(jobs) ?? { total: active.length };
  const saving = current.status === 'saving' || current.status === 'downloaded';
  // The song being saved is already counted as completed; the bar must not count it twice.
  const finished = batchCompleted(jobs) - (saving ? 1 : 0);
  const position = Math.min(finished + 1, total);
  const left = active.length - 1;
  let text =
    left > 0
      ? t('dl.notifText', { title: current.title, count: left })
      : t('dl.notifTextLast', { title: current.title });
  if (waitingNetwork) text = t('dl.notifWaiting');
  return {
    title: t(saving ? 'dl.notifSavingTitle' : 'dl.notifTitle', { done: position, total }),
    text,
    // Never below the last value sent: the batch can grow and the bar must not step back.
    progress: Math.min(
      100,
      Math.max(floor, batchProgress(finished, fractionOf(current, waitingNetwork), total)),
    ),
  };
}

/** true if title/text changed, or progress changed and enough time has passed since the last send. */
export function shouldSend(
  prev: SentNotification | null,
  next: NotificationContent,
  now: number,
): boolean {
  if (!prev) return true;
  const last = prev.content;
  if (last.title !== next.title || last.text !== next.text) return true;
  if (now - prev.at >= HEARTBEAT_MS) return true;
  return last.progress !== next.progress && now - prev.at >= PROGRESS_MIN_GAP_MS;
}

/** How long to wait before re-checking a notice that was held back: progress gap or heartbeat. */
export function nextSendDelay(
  prev: SentNotification,
  next: NotificationContent,
  now: number,
): number {
  const gap = prev.content.progress !== next.progress ? PROGRESS_MIN_GAP_MS : HEARTBEAT_MS;
  return Math.max(0, prev.at + gap - now);
}

/** Remembers the batches seen active, so a long batch is counted whole in the final notice. */
export function createBatchTracker() {
  const ids = new Set<string>();
  return {
    collect(jobs: readonly DownloadJob[]): void {
      for (const j of jobs) if (j.batchId && ACTIVE.has(j.status)) ids.add(j.batchId);
    },
    /** Jobs for the final notice; forgets the batches. */
    take(jobs: readonly DownloadJob[], now: number): DownloadJob[] {
      const counted = jobsForFinalNotice(jobs, ids, now);
      ids.clear();
      return counted;
    },
  };
}

export const RECENT_WINDOW_MS = 60_000;

/** Jobs that count for the final notice: those of the given batches plus the last minute's. */
export function jobsForFinalNotice(
  jobs: readonly DownloadJob[],
  batchIds: ReadonlySet<string>,
  now: number,
): DownloadJob[] {
  return jobs.filter(
    (j) =>
      (j.batchId !== undefined &&
        batchIds.has(j.batchId) &&
        ['done', 'error'].includes(j.status)) ||
      (j.finishedAt !== undefined && now - j.finishedAt < RECENT_WINDOW_MS),
  );
}

/** Final notice for the batch that just ended; null if no song was saved or failed. */
export function doneNotice(finished: readonly DownloadJob[], t: Translate): string | null {
  const count = finished.filter((j) => j.status === 'done').length;
  const failed = finished.filter((j) => j.status === 'error').length;
  if (!count && !failed) return null;
  return failed > 0 ? t('dl.notifDoneSomeFailed', { count, failed }) : t('dl.notifDone', { count });
}
