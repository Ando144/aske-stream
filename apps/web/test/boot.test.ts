import { describe, expect, it } from 'vitest';
import { BOOT_MAX_WAIT_MS, BOOT_MIN_SPLASH_MS, bootReady } from '../src/lib/boot';

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
    expect(bootReady({ setupLoading: false, elapsedMs: 1000, connection: 'offline' })).toBe(true);
  });
});
