import { describe, expect, it } from 'vitest';
import {
  buildRecap,
  currentPeriod,
  periodRange,
  shiftPeriod,
  type PlayRecord,
  type RecapPeriod,
} from '../src/stats/recap';

const march: RecapPeriod = { kind: 'month', year: 2026, month: 3 };
let n = 0;
const rec = (day: number, over: Partial<PlayRecord> = {}, month = 3): PlayRecord => ({
  id: `r${n++}`,
  trackId: 'x',
  title: 'Song',
  artist: 'Art',
  album: '',
  startedAt: new Date(2026, month - 1, day, 12).getTime(),
  listenedSec: 60,
  durationSec: 200,
  skipped: false,
  ...over,
});

describe('periodRange / shiftPeriod', () => {
  it('computes half-open local ranges', () => {
    expect(periodRange(march)).toEqual({
      from: new Date(2026, 2, 1).getTime(),
      to: new Date(2026, 3, 1).getTime(),
    });
    expect(periodRange({ kind: 'year', year: 2026 }).to).toBe(new Date(2027, 0, 1).getTime());
  });

  it('crosses year boundaries', () => {
    expect(shiftPeriod({ kind: 'month', year: 2026, month: 12 }, 1)).toEqual({
      kind: 'month',
      year: 2027,
      month: 1,
    });
    expect(shiftPeriod({ kind: 'month', year: 2026, month: 1 }, -1)).toEqual({
      kind: 'month',
      year: 2025,
      month: 12,
    });
    expect(shiftPeriod({ kind: 'year', year: 2026 }, -2)).toEqual({ kind: 'year', year: 2024 });
  });

  it('gets the current period', () => {
    const now = new Date(2026, 10, 20).getTime();
    expect(currentPeriod('month', now)).toEqual({ kind: 'month', year: 2026, month: 11 });
    expect(currentPeriod('year', now)).toEqual({ kind: 'year', year: 2026 });
  });
});

describe('buildRecap', () => {
  it('counts skipped records only in skipped and breaks streaks', () => {
    const r = buildRecap(
      [rec(1), rec(2, { skipped: true, title: 'Other', artist: 'Z' }), rec(3)],
      march,
    );
    expect(r.skipped).toBe(1);
    expect(r.plays).toBe(2);
    expect(r.distinctTracks).toBe(1);
    expect(r.distinctArtists).toBe(1);
    expect(r.activeDays).toBe(2);
    expect(r.longestStreakDays).toBe(1);
  });

  it('ignores records outside the period', () => {
    const r = buildRecap([rec(1), rec(1, {}, 2), rec(1, {}, 4)], march);
    expect(r.plays).toBe(1);
  });

  it('groups titles, excludes empty artists and rounds minutes', () => {
    const r = buildRecap(
      [
        rec(1, { title: 'Song', listenedSec: 50 }),
        rec(2, { title: 'song ', listenedSec: 50 }),
        rec(3, { title: 'Solo', artist: '', listenedSec: 10 }),
      ],
      march,
    );
    expect(r.topTracks[0]).toEqual({ title: 'Song', artist: 'Art', plays: 2, minutes: 2 });
    expect(r.distinctTracks).toBe(2);
    expect(r.distinctArtists).toBe(1);
    expect(r.topArtists).toHaveLength(1);
    expect(r.minutes).toBe(2); // 110 s
  });

  it('computes the longest streak with gaps and across months', () => {
    const r = buildRecap([rec(1), rec(2), rec(4), rec(5), rec(6), rec(10)], march);
    expect(r.longestStreakDays).toBe(3);
    const year = buildRecap([rec(30, {}, 3), rec(31, {}, 3), rec(1, {}, 4), rec(2, {}, 4)], {
      kind: 'year',
      year: 2026,
    });
    expect(year.longestStreakDays).toBe(4);
    const month = buildRecap([rec(31, {}, 3), rec(1, {}, 4)], march);
    expect(month.longestStreakDays).toBe(1);
  });

  it('limits tops to 5 ordered by plays, minutes, then name', () => {
    const records: PlayRecord[] = [];
    for (let i = 0; i < 7; i++) {
      records.push(rec(1, { title: `T${i}`, artist: `A${i}`, listenedSec: 60 }));
    }
    records.push(rec(2, { title: 'T6', artist: 'A6' }));
    records.push(rec(2, { title: 'T3', artist: 'A3', listenedSec: 600 }));
    const r = buildRecap(records, march);
    expect(r.topTracks).toHaveLength(5);
    expect(r.topTracks.map((t) => t.title)).toEqual(['T3', 'T6', 'T0', 'T1', 'T2']);
    expect(r.topArtists[0]?.artist).toBe('A3');
  });
});
