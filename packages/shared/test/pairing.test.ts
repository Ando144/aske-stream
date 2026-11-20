import { describe, expect, it } from 'vitest';
import {
  formatPairingCode,
  normalizePairingCode,
  pairingLink,
  parsePairingLink,
} from '../src/pairing';

describe('normalizePairingCode', () => {
  it('accepts lowercase, spaces and dashes', () => {
    expect(normalizePairingCode('abcd-2345')).toBe('ABCD2345');
    expect(normalizePairingCode(' abcd 2345 ')).toBe('ABCD2345');
  });

  it('rejects ambiguous symbols', () => {
    for (const bad of ['O', '0', '1', 'I']) {
      expect(normalizePairingCode(`ABCD234${bad}`)).toBeNull();
    }
  });

  it('rejects wrong lengths', () => {
    expect(normalizePairingCode('ABCD234')).toBeNull();
    expect(normalizePairingCode('ABCD23456')).toBeNull();
    expect(normalizePairingCode('')).toBeNull();
  });
});

describe('formatPairingCode', () => {
  it('inserts a dash in the middle', () => {
    expect(formatPairingCode('ABCD2345')).toBe('ABCD-2345');
  });
});

describe('pairingLink', () => {
  it('builds the link and trims the trailing slash', () => {
    expect(pairingLink('https://a.workers.dev/', 'ABCD2345')).toBe(
      'https://a.workers.dev/#code=ABCD2345',
    );
    expect(pairingLink('https://a.workers.dev', 'ABCD2345')).toBe(
      'https://a.workers.dev/#code=ABCD2345',
    );
  });
});

describe('parsePairingLink', () => {
  it('accepts https links, dropping path and normalizing the code', () => {
    expect(parsePairingLink('https://aske-stream.x.workers.dev/#code=abcd-2345')).toEqual({
      baseUrl: 'https://aske-stream.x.workers.dev',
      code: 'ABCD2345',
    });
    expect(parsePairingLink('https://x.workers.dev/some/path/#code=ABCD2345')).toEqual({
      baseUrl: 'https://x.workers.dev',
      code: 'ABCD2345',
    });
  });

  it('accepts http only for local hosts', () => {
    for (const host of ['localhost:8787', '127.0.0.1:8787', '10.0.2.2:8787']) {
      expect(parsePairingLink(`http://${host}/#code=ABCD2345`)?.code).toBe('ABCD2345');
    }
    expect(parsePairingLink('http://example.com/#code=ABCD2345')).toBeNull();
  });

  it('rejects dangerous schemes, missing or invalid codes and garbage', () => {
    expect(parsePairingLink('javascript:alert(1)//#code=ABCD2345')).toBeNull();
    expect(parsePairingLink('https://x.workers.dev/')).toBeNull();
    expect(parsePairingLink('https://x.workers.dev/#code=ABCD')).toBeNull();
    expect(parsePairingLink('https://x.workers.dev/#code=ABCD2O45')).toBeNull();
    expect(parsePairingLink('not a url')).toBeNull();
  });
});
