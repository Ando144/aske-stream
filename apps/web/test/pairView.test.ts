import { describe, expect, it, vi } from 'vitest';
import { pairingLink } from '@aske/shared/pairing';

vi.mock('../src/offline/db', () => ({ getDb: vi.fn(), kvGet: vi.fn() }));

import { isSubmitBlocked } from '../src/views/PairView';

describe('isSubmitBlocked', () => {
  it('blocks while busy', () => {
    expect(isSubmitBlocked(true, true, 'ABCD-2345')).toBe(true);
  });

  it('blocks a plain code when the address is missing', () => {
    expect(isSubmitBlocked(false, false, 'ABCD-2345')).toBe(true);
  });

  it('allows a pasted link even without an address', () => {
    const link = pairingLink('https://aske.example.workers.dev', 'ABCD2345');
    expect(isSubmitBlocked(false, false, `  ${link} `)).toBe(false);
  });

  it('allows a plain code with a valid address', () => {
    expect(isSubmitBlocked(false, true, 'ABCD-2345')).toBe(false);
  });
});
