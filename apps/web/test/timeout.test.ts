import { afterEach, describe, expect, it, vi } from 'vitest';
import { isTimeout, TimeoutError, withTimeout } from '../src/lib/timeout';

afterEach(() => vi.useRealTimers());

describe('withTimeout', () => {
  it('resolves when the promise is fast enough', async () => {
    await expect(withTimeout(Promise.resolve(7), 100)).resolves.toBe(7);
  });

  it('rejects with TimeoutError when it takes too long', async () => {
    vi.useFakeTimers();
    const result = withTimeout(new Promise<void>(() => undefined), 100);
    const assertion = expect(result).rejects.toBeInstanceOf(TimeoutError);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });

  it('passes through the original rejection', async () => {
    await expect(withTimeout(Promise.reject(new Error('boom')), 100)).rejects.toThrow('boom');
  });
});

describe('isTimeout', () => {
  it('recognises timeouts only', () => {
    const err = new TimeoutError();
    expect(err.message).toBe('timeout');
    expect(err.name).toBe('TimeoutError');
    expect(isTimeout(err)).toBe(true);
    expect(isTimeout(new Error('timeout'))).toBe(false);
    expect(isTimeout('x')).toBe(false);
  });
});
