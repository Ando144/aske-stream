import { describe, expect, it } from 'vitest';
import {
  GROUP_LIMITS,
  hubGroupLink,
  isAcceptableMonth,
  isGroupId,
  isMonthKey,
  normalizeInviteCode,
  oldestKeptMonth,
  parseGroupInput,
  sanitizeGroupName,
  sanitizeMonthStats,
  shiftMonthKey,
  utcMonthKey,
} from '../src/groups';

const NOW = Date.UTC(2026, 10, 23); // 2026-11

const track = (n: number) => ({ title: `T${n}`, artist: 'A', plays: n, minutes: n });
const valid = (over: Record<string, unknown> = {}) => ({
  month: '2026-11',
  minutes: 10,
  plays: 4,
  topTracks: [track(1)],
  topArtists: [{ artist: 'A', plays: 1, minutes: 1 }],
  ...over,
});

describe('month keys', () => {
  it('validates the format', () => {
    expect(isMonthKey('2026-01')).toBe(true);
    expect(isMonthKey('2026-13')).toBe(false);
    expect(isMonthKey('2026-1')).toBe(false);
  });

  it('builds the UTC month', () => {
    expect(utcMonthKey(NOW)).toBe('2026-11');
  });

  it('shifts across years in both directions', () => {
    expect(shiftMonthKey('2026-01', -1)).toBe('2025-12');
    expect(shiftMonthKey('2025-12', 1)).toBe('2026-01');
    expect(shiftMonthKey('2026-11', -23)).toBe('2024-12');
  });

  it('keeps 12 months including the current one', () => {
    expect(oldestKeptMonth(NOW)).toBe('2025-12');
  });

  it('accepts the range and rejects outside it', () => {
    expect(isAcceptableMonth('2025-12', NOW)).toBe(true);
    expect(isAcceptableMonth('2025-11', NOW)).toBe(false);
    expect(isAcceptableMonth('2026-12', NOW)).toBe(true);
    expect(isAcceptableMonth('2027-01', NOW)).toBe(false);
    expect(isAcceptableMonth('nope', NOW)).toBe(false);
  });
});

describe('sanitizeMonthStats', () => {
  it('accepts valid stats', () => {
    expect(sanitizeMonthStats(valid())?.plays).toBe(4);
  });

  it('cuts the tops to topSize', () => {
    const many = Array.from({ length: 15 }, (_, i) => track(i));
    const out = sanitizeMonthStats(valid({ topTracks: many }));
    expect(out?.topTracks).toHaveLength(GROUP_LIMITS.topSize);
  });

  it('rejects negative or fractional numbers', () => {
    expect(sanitizeMonthStats(valid({ minutes: -1 }))).toBeNull();
    expect(sanitizeMonthStats(valid({ plays: 1.5 }))).toBeNull();
    expect(sanitizeMonthStats(valid({ topTracks: [{ ...track(1), plays: -2 }] }))).toBeNull();
  });

  it('rejects an invalid month or shape', () => {
    expect(sanitizeMonthStats(valid({ month: '2026-13' }))).toBeNull();
    expect(sanitizeMonthStats(null)).toBeNull();
    expect(sanitizeMonthStats(valid({ topArtists: 'x' }))).toBeNull();
  });
});

describe('names and codes', () => {
  it('sanitizes group names', () => {
    expect(sanitizeGroupName('  Amigos \u0000 ')).toBe('Amigos');
    expect(sanitizeGroupName('   ')).toBeNull();
    expect(sanitizeGroupName(5)).toBeNull();
    expect(sanitizeGroupName('x'.repeat(100))).toHaveLength(GROUP_LIMITS.nameMax);
  });

  it('normalizes invite codes', () => {
    expect(normalizeInviteCode('abcd-efgh')).toBe('ABCDEFGH');
    expect(normalizeInviteCode('abc')).toBeNull();
    expect(normalizeInviteCode('ABCDEFG0')).toBeNull();
  });

  it('checks group ids', () => {
    expect(isGroupId('ABCDEFGHJK')).toBe(true);
    expect(isGroupId('ABC')).toBe(false);
  });
});

describe('group links', () => {
  it('builds and parses a link', () => {
    const link = hubGroupLink('https://hub.example/', 'ABCDEFGH');
    expect(link).toBe('https://hub.example/#group=ABCDEFGH');
    expect(parseGroupInput(link)).toBe('ABCDEFGH');
  });

  it('parses a bare code', () => {
    expect(parseGroupInput(' abcd-efgh ')).toBe('ABCDEFGH');
  });

  it('allows http only for local hosts', () => {
    expect(parseGroupInput('http://localhost:8788/#group=ABCDEFGH')).toBe('ABCDEFGH');
    expect(parseGroupInput('http://evil.example/#group=ABCDEFGH')).toBeNull();
  });

  it('ignores other hashes', () => {
    expect(parseGroupInput('https://hub.example/#jam=ABCDEF')).toBeNull();
    expect(parseGroupInput('https://hub.example/')).toBeNull();
  });
});
