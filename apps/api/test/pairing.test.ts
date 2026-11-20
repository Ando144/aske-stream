import { describe, expect, it } from 'vitest';
import { PAIRING_CODE_ALPHABET, normalizePairingCode } from '@aske/shared/pairing';
import { generatePairingCode, hashPairingCode } from '../src/lib/pairing';
import { WORKER_VERSION } from '../src/version';
import pkg from '../package.json';

describe('generatePairingCode', () => {
  it('makes 8 symbols from the alphabet that normalize to themselves', () => {
    for (let i = 0; i < 200; i++) {
      const code = generatePairingCode();
      expect(code).toHaveLength(8);
      expect([...code].every((c) => PAIRING_CODE_ALPHABET.includes(c))).toBe(true);
      expect(normalizePairingCode(code)).toBe(code);
    }
  });

  it('does not repeat', () => {
    const codes = new Set(Array.from({ length: 50 }, generatePairingCode));
    expect(codes.size).toBe(50);
  });
});

describe('hashPairingCode', () => {
  it('is a stable SHA-256 hex digest', async () => {
    const hash = await hashPairingCode('ABCD2345');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPairingCode('ABCD2345')).toBe(hash);
    expect(await hashPairingCode('ABCD2346')).not.toBe(hash);
  });
});

describe('WORKER_VERSION', () => {
  it('matches package.json', () => {
    expect(WORKER_VERSION).toBe(pkg.version);
  });
});
