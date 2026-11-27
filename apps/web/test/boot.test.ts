import { describe, expect, it } from 'vitest';
import {
  BOOT_MAX_WAIT_MS,
  BOOT_MIN_SPLASH_MS,
  BOOT_PULSE_AFTER_MS,
  SPLASH_EXIT_MS,
  bootReady,
  shouldPulse,
  splashTimings,
} from '../src/lib/boot';

describe('splashTimings', () => {
  it('shows the logo briefly and fades out gently', () => {
    expect(splashTimings(false)).toEqual({ minMs: 400, exitMs: 300 });
    expect(splashTimings(false)).toEqual({ minMs: BOOT_MIN_SPLASH_MS, exitMs: SPLASH_EXIT_MS });
  });

  it('fades out faster with reduced motion', () => {
    expect(splashTimings(true)).toEqual({ minMs: 400, exitMs: 150 });
  });
});

describe('shouldPulse', () => {
  it('stays still while the app opens quickly', () => {
    expect(shouldPulse(0, false)).toBe(false);
    expect(shouldPulse(999, false)).toBe(false);
  });

  it('pulses once opening takes a second or more', () => {
    expect(BOOT_PULSE_AFTER_MS).toBe(1000);
    expect(shouldPulse(1000, false)).toBe(true);
    expect(shouldPulse(4000, false)).toBe(true);
  });

  it('never pulses with reduced motion', () => {
    expect(shouldPulse(1000, true)).toBe(false);
    expect(shouldPulse(BOOT_MAX_WAIT_MS, true)).toBe(false);
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
