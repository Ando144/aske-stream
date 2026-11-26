// Retry policy for saving downloaded songs (pure; duck typing only).
import { BIG_AUDIO_BYTES, type HomeKind } from './pipeline';
import type { DownloadJob } from './types';

export const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000, 600_000] as const;
export const MAX_ATTEMPTS = 6;
/** Each attempt of a big upload takes long: two failures are enough. */
const BIG_MAX_ATTEMPTS = 2;

export type FailureKind = 'network' | 'canceled' | 'fatal';

export type RetryPlan =
  | { action: 'wait-network' }
  | { action: 'retry'; attempts: number; retryAt: number }
  | { action: 'give-up' };

export type SaveFailurePlan =
  | { action: 'wait-network' }
  | { action: 'retry'; patch: Partial<DownloadJob> }
  | { action: 'to-phone' }
  | { action: 'end'; canceled: boolean };

const NETWORK_MESSAGE =
  /network|timed out|timeout|connection|unable to resolve host|failed to fetch|no connection/i;
const FATAL_CODES = new Set(['drive_full', 'storage_full', 'drive_auth']);
const NETWORK_NAMES = new Set(['TypeError', 'TimeoutError', 'AbortError']);

interface FailureLike {
  code?: unknown;
  status?: unknown;
  name?: unknown;
  message?: unknown;
}

function kindFromStatus(status: number): FailureKind | null {
  if (status === 0 || status === 408 || status === 429 || status >= 500) return 'network';
  if (status >= 400 && status < 500) return 'fatal';
  return null;
}

export function classifyFailure(err: unknown): FailureKind {
  if (typeof err !== 'object' || err === null) return 'fatal';
  const e = err as FailureLike;
  if (e.code === 'canceled') return 'canceled';
  if (e.code === 'network') return 'network';
  if (typeof e.code === 'string' && FATAL_CODES.has(e.code)) return 'fatal';
  if (e.name === 'DriveAuthRequired') return 'fatal';
  if (typeof e.status === 'number') {
    const byStatus = kindFromStatus(e.status);
    if (byStatus) return byStatus;
  }
  if (typeof e.name === 'string' && NETWORK_NAMES.has(e.name)) return 'network';
  if (typeof e.message === 'string' && NETWORK_MESSAGE.test(e.message)) return 'network';
  return 'fatal';
}

/** The server failed or the upload ran out of time (as opposed to losing the connection). */
function isServerFailure(err: unknown): boolean {
  const { status, name } = (err ?? {}) as FailureLike;
  if (name === 'TimeoutError') return true;
  return typeof status === 'number' && (status === 408 || status >= 500);
}

export function planRetry(attempts: number, now: number, online: boolean, bytes = 0): RetryPlan {
  if (!online) return { action: 'wait-network' };
  const allowed = bytes > BIG_AUDIO_BYTES ? BIG_MAX_ATTEMPTS - 1 : MAX_ATTEMPTS;
  if (attempts >= allowed) return { action: 'give-up' };
  return {
    action: 'retry',
    attempts: attempts + 1,
    retryAt: now + (RETRY_DELAYS_MS[attempts] ?? 0),
  };
}

/** What to do with a job whose save failed. `job.target` is where it was being saved. */
export function planSaveFailure(
  job: DownloadJob,
  err: unknown,
  { home, online, now }: { home: HomeKind; online: boolean; now: number },
): SaveFailurePlan {
  // Writing on the phone needs no network: trying again by itself would not help.
  if (job.target === 'device-only') return { action: 'end', canceled: false };
  const kind = classifyFailure(err);
  if (kind !== 'network') return { action: 'end', canceled: kind === 'canceled' };
  const bytes = job.file?.bytes ?? 0;
  const big = bytes > BIG_AUDIO_BYTES && isServerFailure(err);
  const failed = (big ? job.serverFailures : job.attempts) ?? 0;
  const plan = planRetry(failed, now, online, big ? bytes : 0);
  if (plan.action === 'wait-network') return { action: 'wait-network' };
  if (plan.action === 'retry') {
    const counter = big ? { serverFailures: plan.attempts } : { attempts: plan.attempts };
    return { action: 'retry', patch: { ...counter, retryAt: plan.retryAt } };
  }
  if (big && home === 'cloudflare') return { action: 'to-phone' };
  return { action: 'end', canceled: false };
}
