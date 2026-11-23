import { describe, expect, it } from 'vitest';
import { BOOT_MAX_WAIT_MS, BOOT_MIN_SPLASH_MS, bootReady, splashTimings } from '../src/lib/boot';

describe('splashTimings', () => {
  it('holds the finished logo and fades out gently', () => {
    expect(splashTimings(false)).toEqual({ minMs: 1800, exitMs: 500 });
  });

  it('is short and fade-only with reduced motion', () => {
    expect(splashTimings(true)).toEqual({ minMs: 600, exitMs: 200 });
  });
});

describe('bootReady with a custom minimum', () => {
  it('is false before minMs and true at minMs', () => {
    const base = { setupLoading: false, connection: 'online' as const };
    expect(bootReady({ ...base, elapsedMs: 599 }, 600)).toBe(false);
    expect(bootReady({ ...base, elapsedMs: 600 }, 600)).toBe(true);
  });
});

describe('bootReady', () => {
  it('waits for the minimum splash time', () => {
    expect(bootReady({ setupLoading: false, elapsedMs: 100, connection: 'online' })).toBe(false);
    expect(
      bootReady({ setupLoading: false, elapsedMs: BOOT_MIN_SPLASH_MS, connection: 'online' }),
    ).toBe(true);
  });

  it('waits while setup is loading', () => {
    expect(bootReady({ setupLoading: true, elapsedMs: 9000, connection: 'offline' })).toBe(false);
  });

  it('waits for the connection check until the maximum wait', () => {
    expect(bootReady({ setupLoading: false, elapsedMs: 3000, connection: 'checking' })).toBe(false);
    expect(
      bootReady({ setupLoading: false, elapsedMs: BOOT_MAX_WAIT_MS, connection: 'checking' }),
    ).toBe(true);
  });

  it('does not wait when offline', () => {
    expect(
      bootReady({ setupLoading: false, elapsedMs: BOOT_MIN_SPLASH_MS, connection: 'offline' }),
    ).toBe(true);
  });
});
