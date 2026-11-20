import { describe, expect, it } from 'vitest';
import {
  advanceSession,
  countThreshold,
  isRestart,
  startSession,
  type PlayerSample,
} from '../src/stats/listen';

const sample = (over: Partial<PlayerSample> = {}): PlayerSample => ({
  trackId: 't1',
  isPlaying: true,
  position: 0,
  durationSec: 200,
  now: 1000,
  ...over,
});

describe('countThreshold', () => {
  it('uses min(30, half the duration)', () => {
    expect(countThreshold(200)).toBe(30);
    expect(countThreshold(40)).toBe(20);
    expect(countThreshold(0)).toBe(30);
  });
});

describe('advanceSession', () => {
  it('counts exactly once when reaching the threshold', () => {
    let s = startSession({ ...sample(), trackId: 't1' });
    let counted = 0;
    for (let i = 1; i <= 160; i++) {
      const r = advanceSession(s, sample({ position: i * 0.25 }));
      s = r.session;
      if (r.justCounted) counted += 1;
    }
    expect(counted).toBe(1);
    expect(s.counted).toBe(true);
    expect(s.listenedSec).toBeCloseTo(40);
  });

  it('does not add time while paused', () => {
    const s = startSession({ ...sample(), trackId: 't1' });
    const r = advanceSession(s, sample({ isPlaying: false, position: 1 }));
    expect(r.session.listenedSec).toBe(0);
    expect(r.session.lastPosition).toBe(1);
  });

  it('ignores forward seeks and does not subtract on backward seeks', () => {
    let s = startSession({ ...sample(), trackId: 't1' });
    s = advanceSession(s, sample({ position: 1 })).session;
    s = advanceSession(s, sample({ position: 61 })).session;
    expect(s.listenedSec).toBe(1);
    s = advanceSession(s, sample({ position: 10 })).session;
    expect(s.listenedSec).toBe(1);
    s = advanceSession(s, sample({ position: 11 })).session;
    expect(s.listenedSec).toBe(2);
  });
});

describe('isRestart', () => {
  const ended = { ...startSession({ ...sample(), trackId: 't1' }), lastPosition: 199 };

  it('detects repeat-one after reaching the end', () => {
    expect(isRestart(ended, sample({ position: 0.2 }))).toBe(true);
  });

  it('does not confuse a backward seek in mid-song', () => {
    const mid = { ...ended, lastPosition: 100 };
    expect(isRestart(mid, sample({ position: 0.5 }))).toBe(false);
  });
});
