import { describe, expect, it } from 'vitest';
import type { PlayRecord } from '../src/stats/recap';
import {
  buildMonthStats,
  buildUploads,
  monthKeyOfPeriod,
  monthsToUpload,
} from '../src/groups/snapshot';

function rec(i: number, at: Date, over: Partial<PlayRecord> = {}): PlayRecord {
  return {
    id: `r${i}`,
    trackId: `t${i}`,
    title: `Song ${i}`,
    artist: `Artist ${i}`,
    album: '',
    startedAt: at.getTime(),
    listenedSec: 60,
    durationSec: 120,
    skipped: false,
    ...over,
  };
}

describe('monthKeyOfPeriod', () => {
  it('pads the month', () => {
    expect(monthKeyOfPeriod({ kind: 'month', year: 2026, month: 3 })).toBe('2026-03');
    expect(monthKeyOfPeriod({ kind: 'month', year: 2026, month: 12 })).toBe('2026-12');
  });
});

describe('buildMonthStats', () => {
  const period = { kind: 'month', year: 2026, month: 5 } as const;

  it('uses the local month, tops of 10 and leaves skipped songs out', () => {
    const records = Array.from({ length: 14 }, (_, i) => rec(i, new Date(2026, 4, 10, 12)));
    records.push(rec(99, new Date(2026, 4, 11), { skipped: true }));
    records.push(rec(100, new Date(2026, 5, 1, 0, 0, 1))); // next month
    const stats = buildMonthStats(records, period);
    expect(stats.month).toBe('2026-05');
    expect(stats.plays).toBe(14);
    expect(stats.minutes).toBe(14);
    expect(stats.topTracks).toHaveLength(10);
    expect(stats.topArtists).toHaveLength(10);
    expect(stats.topTracks.some((t) => t.title === 'Song 99')).toBe(false);
  });
});

describe('monthsToUpload', () => {
  it('gives 12 months across the year change on the first sync', () => {
    const months = monthsToUpload(new Date(2026, 1, 20).getTime(), true).map((p) =>
      monthKeyOfPeriod(p),
    );
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-02');
    expect(months[1]).toBe('2026-01');
    expect(months[2]).toBe('2025-12');
    expect(months[11]).toBe('2025-03');
  });

  it('adds the previous month only during the first 7 days', () => {
    const keys = (d: number) =>
      monthsToUpload(new Date(2026, 0, d, 12).getTime(), false).map(monthKeyOfPeriod);
    expect(keys(7)).toEqual(['2026-01', '2025-12']);
    expect(keys(8)).toEqual(['2026-01']);
  });
});

describe('buildUploads', () => {
  it('skips months without listening', () => {
    const now = new Date(2026, 1, 3, 12).getTime();
    const records = [rec(1, new Date(2026, 1, 2, 12)), rec(2, new Date(2025, 11, 5, 12))];
    const months = buildUploads(records, now, true).map((m) => m.month);
    expect(months).toEqual(['2026-02', '2025-12']);
  });
});
