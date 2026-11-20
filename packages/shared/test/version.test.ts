import { describe, expect, it } from 'vitest';
import { compareVersions, isServerOutdated } from '../src/version';

describe('compareVersions', () => {
  it('compares numerically', () => {
    expect(compareVersions('0.10.0', '0.9.9')).toBe(1);
    expect(compareVersions('0.5.5', '0.6.0')).toBe(-1);
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0);
  });

  it('ignores suffixes and treats invalid text as 0.0.0', () => {
    expect(compareVersions('1.2.3-beta', '1.2.3')).toBe(0);
    expect(compareVersions('garbage', '0.0.0')).toBe(0);
    expect(compareVersions('garbage', '0.0.1')).toBe(-1);
  });
});

describe('isServerOutdated', () => {
  it('is true when the server version is missing or lower', () => {
    expect(isServerOutdated(undefined, '0.6.0')).toBe(true);
    expect(isServerOutdated('', '0.6.0')).toBe(true);
    expect(isServerOutdated('0.5.5', '0.6.0')).toBe(true);
  });

  it('is false when the server is equal or newer', () => {
    expect(isServerOutdated('0.6.0', '0.6.0')).toBe(false);
    expect(isServerOutdated('0.7.0', '0.6.0')).toBe(false);
  });
});
