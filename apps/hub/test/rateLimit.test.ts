import { describe, expect, it } from 'vitest';
import { checkRateLimit } from '../src/lib/rateLimit';
import { FakeD1 } from './fakeDb';

const HOUR = 3600 * 1000;

describe('checkRateLimit', () => {
  it('allows 20 requests per hour and refuses the 21st', async () => {
    const db = new FakeD1() as unknown as D1Database;
    const now = 10 * HOUR + 5;
    for (let i = 0; i < 20; i++) expect(await checkRateLimit(db, 'k', 20, HOUR, now)).toBe(true);
    expect(await checkRateLimit(db, 'k', 20, HOUR, now)).toBe(false);
  });

  it('lets the caller in again in the next window', async () => {
    const db = new FakeD1() as unknown as D1Database;
    const now = 10 * HOUR + 5;
    for (let i = 0; i < 21; i++) await checkRateLimit(db, 'k', 20, HOUR, now);
    expect(await checkRateLimit(db, 'k', 20, HOUR, now + HOUR)).toBe(true);
  });

  it('counts each key separately', async () => {
    const db = new FakeD1() as unknown as D1Database;
    expect(await checkRateLimit(db, 'a', 1, HOUR, 0)).toBe(true);
    expect(await checkRateLimit(db, 'b', 1, HOUR, 0)).toBe(true);
    expect(await checkRateLimit(db, 'a', 1, HOUR, 0)).toBe(false);
  });
});
