import { describe, expect, it } from 'vitest';
import { MAX_ATTEMPTS, RETRY_DELAYS_MS, classifyFailure, planRetry } from '../src/downloads/retry';

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
