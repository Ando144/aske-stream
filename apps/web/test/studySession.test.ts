import { describe, expect, it } from 'vitest';
import {
  DUCK_LEVEL,
  FADE_MS,
  clampStudyMinutes,
  createSession,
  formatClock,
  musicFactor,
  remainingMs,
  restoreDecision,
  studiedMinutes,
} from '../src/study/session';

const MIN = 60_000;
const s = createSession(1_000_000, 25, { kind: 'library' }, 'a');

describe('clampStudyMinutes', () => {
  it('handles NaN, low and high values', () => {
    expect(clampStudyMinutes(NaN)).toBe(25);
    expect(clampStudyMinutes(0)).toBe(5);
    expect(clampStudyMinutes(300)).toBe(240);
    expect(clampStudyMinutes(30.4)).toBe(30);
  });
});

describe('session', () => {
  it('creates and measures the remaining time', () => {
    expect(s.endsAt).toBe(s.startedAt + 25 * MIN);
    expect(remainingMs(s, s.startedAt + MIN)).toBe(24 * MIN);
    expect(remainingMs(s, s.endsAt + 5)).toBe(0);
  });

  it('fades the music in the last seconds', () => {
    expect(musicFactor(s, s.endsAt - FADE_MS - 1)).toBe(1);
    expect(musicFactor(s, s.endsAt - FADE_MS / 2)).toBeCloseTo((1 + DUCK_LEVEL) / 2);
    expect(musicFactor(s, s.endsAt)).toBe(DUCK_LEVEL);
    expect(musicFactor(s, s.endsAt + 10_000)).toBe(DUCK_LEVEL);
  });

  it('counts studied minutes when giving up halfway', () => {
    expect(studiedMinutes(s, s.startedAt + 10 * MIN + 59_000)).toBe(10);
    expect(studiedMinutes(s, s.endsAt + 99 * MIN)).toBe(25);
    expect(studiedMinutes(s, s.startedAt - 5)).toBe(0);
  });
});

describe('restoreDecision', () => {
  it('decides none, resume and ended', () => {
    expect(restoreDecision(null, s.startedAt)).toEqual({ kind: 'none' });
    expect(restoreDecision(s, s.startedAt + MIN)).toEqual({ kind: 'resume', session: s });
    expect(restoreDecision(s, s.endsAt)).toEqual({ kind: 'ended', session: s });
  });

  it('rejects garbage', () => {
    expect(restoreDecision('x', 0).kind).toBe('none');
    expect(restoreDecision({ ...s, id: 3 }, 0).kind).toBe('none');
    expect(restoreDecision({ ...s, endsAt: s.startedAt }, 0).kind).toBe('none');
    expect(restoreDecision({ ...s, startedAt: Infinity }, 0).kind).toBe('none');
    expect(restoreDecision({ ...s, source: { kind: 'playlist' } }, 0).kind).toBe('none');
    expect(restoreDecision({ ...s, source: { kind: 'zzz' } }, 0).kind).toBe('none');
  });
});

describe('formatClock', () => {
  it('formats hours, minutes and seconds', () => {
    expect(formatClock(3_909_000)).toBe('1:05:09');
    expect(formatClock(24 * MIN + 59_000)).toBe('24:59');
    expect(formatClock(7_000)).toBe('0:07');
    expect(formatClock(-5)).toBe('0:00');
  });
});
