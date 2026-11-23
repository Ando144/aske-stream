import { describe, expect, it } from 'vitest';
import { summarizeStudy, type StudyRecord } from '../src/study/records';

const now = new Date(2026, 5, 15, 12, 0, 0).getTime();
const DAY = 86_400_000;

function rec(daysAgo: number, studiedMin: number, completed = true): StudyRecord {
  const startedAt = now - daysAgo * DAY;
  return {
    id: `r${daysAgo}-${studiedMin}`,
    startedAt,
    endedAt: startedAt + studiedMin * 60_000,
    plannedMin: 25,
    studiedMin,
    completed,
  };
}

describe('summarizeStudy', () => {
  it('returns zeros for an empty list', () => {
    expect(summarizeStudy([], now)).toEqual({
      todayMin: 0,
      weekMin: 0,
      sessions: 0,
      completed: 0,
      streakDays: 0,
    });
  });

  it('adds today and the last 7 days, counting sessions and completed ones', () => {
    const s = summarizeStudy([rec(0, 25), rec(0, 10, false), rec(6, 30), rec(7, 99)], now);
    expect(s.todayMin).toBe(35);
    expect(s.weekMin).toBe(65);
    expect(s.sessions).toBe(4);
    expect(s.completed).toBe(3);
  });

  it('counts a streak that ends today', () => {
    expect(summarizeStudy([rec(0, 5), rec(1, 5), rec(2, 5), rec(4, 5)], now).streakDays).toBe(3);
  });

  it('keeps a streak that ends yesterday', () => {
    expect(summarizeStudy([rec(1, 5), rec(2, 5)], now).streakDays).toBe(2);
  });

  it('breaks the streak when the last study was two days ago or had no minutes', () => {
    expect(summarizeStudy([rec(2, 5), rec(3, 5)], now).streakDays).toBe(0);
    expect(summarizeStudy([rec(0, 0, false)], now).streakDays).toBe(0);
  });
});
