// Retry policy for saving downloaded songs (pure; duck typing only).

export const RETRY_DELAYS_MS = [15_000, 30_000, 60_000, 120_000, 300_000, 600_000] as const;
export const MAX_ATTEMPTS = 6;

export type FailureKind = 'network' | 'canceled' | 'fatal';

export type RetryPlan =
  | { action: 'wait-network' }
  | { action: 'retry'; attempts: number; retryAt: number }
  | { action: 'give-up' };

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

export function planRetry(attempts: number, now: number, online: boolean): RetryPlan {
  if (!online) return { action: 'wait-network' };
  if (attempts >= MAX_ATTEMPTS) return { action: 'give-up' };
  return {
    action: 'retry',
    attempts: attempts + 1,
    retryAt: now + (RETRY_DELAYS_MS[attempts] ?? 0),
  };
}
