import { describe, expect, it } from 'vitest';
import {
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  classifyFailure,
  planRetry,
  planSaveFailure,
} from '../src/downloads/retry';
import type { DownloadJob } from '../src/downloads/types';

const named = (name: string) => Object.assign(new Error('x'), { name });

describe('classifyFailure', () => {
  it.each([
    [{ status: 0 }, 'network'],
    [{ status: 503 }, 'network'],
    [{ status: 429 }, 'network'],
    [{ status: 408 }, 'network'],
    [{ status: 404 }, 'fatal'],
    [new TypeError('x'), 'network'],
    [named('TimeoutError'), 'network'],
    [named('AbortError'), 'network'],
    [{ code: 'canceled' }, 'canceled'],
    [{ code: 'network' }, 'network'],
    [{ code: 'drive_full' }, 'fatal'],
    [{ code: 'storage_full' }, 'fatal'],
    [{ code: 'drive_auth' }, 'fatal'],
    [named('DriveAuthRequired'), 'fatal'],
    [new Error('Unable to resolve host "youtube.com"'), 'network'],
    [new Error('Failed to fetch'), 'network'],
    [new Error('Private video'), 'fatal'],
    ['boom', 'fatal'],
    [null, 'fatal'],
  ])('classifies %j as %s', (err, kind) => {
    expect(classifyFailure(err)).toBe(kind);
  });
});

describe('planRetry', () => {
  it('waits for the network without counting an attempt', () => {
    expect(planRetry(2, 1000, false)).toEqual({ action: 'wait-network' });
  });

  it('follows the delay table for attempts 0..5', () => {
    for (let n = 0; n < MAX_ATTEMPTS; n++) {
      expect(planRetry(n, 1000, true)).toEqual({
        action: 'retry',
        attempts: n + 1,
        retryAt: 1000 + RETRY_DELAYS_MS[n]!,
      });
    }
  });

  it('gives up after the last attempt', () => {
    expect(planRetry(MAX_ATTEMPTS, 1000, true)).toEqual({ action: 'give-up' });
  });
});

const MB = 1024 * 1024;

describe('planRetry for big files', () => {
  it('gives up at the second failure', () => {
    expect(planRetry(0, 1000, true, 40 * MB).action).toBe('retry');
    expect(planRetry(1, 1000, true, 40 * MB)).toEqual({ action: 'give-up' });
    expect(planRetry(1, 1000, false, 40 * MB)).toEqual({ action: 'wait-network' });
  });
});

describe('planSaveFailure', () => {
  const big = (extra: Partial<DownloadJob> = {}) =>
    ({ file: { bytes: 40 * MB }, target: 'home', ...extra }) as DownloadJob;
  const ctx = { home: 'cloudflare' as const, online: true, now: 1000 };

  it('moves a big file to the phone after two server failures', () => {
    expect(planSaveFailure(big(), { status: 503 }, ctx)).toMatchObject({
      action: 'retry',
      patch: { serverFailures: 1 },
    });
    expect(planSaveFailure(big({ serverFailures: 1 }), { status: 408 }, ctx).action).toBe(
      'to-phone',
    );
  });

  it('does not count a lost connection against a big file', () => {
    const job = big({ serverFailures: 1 });
    expect(planSaveFailure(job, { status: 0 }, ctx).action).toBe('retry');
    expect(planSaveFailure(job, { status: 503 }, { ...ctx, online: false }).action).toBe(
      'wait-network',
    );
  });

  it('gives up on Drive instead of moving to the phone', () => {
    const job = big({ serverFailures: 1 });
    expect(planSaveFailure(job, { status: 500 }, { ...ctx, home: 'drive' })).toEqual({
      action: 'end',
      canceled: false,
    });
  });

  it('never retries a failed phone-only save', () => {
    const job = big({ target: 'device-only' });
    expect(planSaveFailure(job, new TypeError('x'), ctx)).toEqual({
      action: 'end',
      canceled: false,
    });
  });
});
