import { describe, expect, it } from 'vitest';
import {
  neighbourOffset,
  swipeDecision,
  swipeProgress,
  swipeThreshold,
  type SwipeSample,
} from '../src/lib/swipe';

const swipe = (changes: Partial<SwipeSample>) =>
  swipeDecision({ dx: 0, dy: 0, ms: 300, width: 400, startX: 200, ...changes });

describe('swipeDecision', () => {
  it('follows the direction of a long horizontal swipe', () => {
    expect(swipe({ dx: -150 })).toBe('left');
    expect(swipe({ dx: 150 })).toBe('right');
  });

  it('ignores vertical and diagonal movements', () => {
    expect(swipe({ dx: 20, dy: 200 })).toBeNull();
    expect(swipe({ dx: 160, dy: 100 })).toBeNull();
    expect(swipe({ dx: -161, dy: -100 })).toBe('left');
  });

  it('ignores a short and slow swipe', () => {
    expect(swipe({ dx: 60, ms: 600 })).toBeNull();
    expect(swipe({ dx: -95, ms: 600 })).toBeNull();
  });

  it('triggers at 96 px, or at a quarter of a narrow width', () => {
    expect(swipe({ dx: 96, ms: 600 })).toBe('right');
    expect(swipe({ dx: 75, ms: 600, width: 300, startX: 150 })).toBe('right');
    expect(swipe({ dx: 74, ms: 600, width: 300, startX: 150 })).toBeNull();
  });

  it('accepts a short but quick swipe', () => {
    expect(swipe({ dx: -40, ms: 60 })).toBe('left');
    expect(swipe({ dx: 40, ms: 80 })).toBeNull();
    expect(swipe({ dx: 39, ms: 20 })).toBeNull();
  });

  it('ignores swipes that start near either screen edge', () => {
    expect(swipe({ dx: 150, startX: 23 })).toBeNull();
    expect(swipe({ dx: -150, startX: 377 })).toBeNull();
    expect(swipe({ dx: 150, startX: 24 })).toBe('right');
    expect(swipe({ dx: -150, startX: 376 })).toBe('left');
  });
});

describe('swipeThreshold', () => {
  it('is a quarter of a narrow width, capped on wide ones', () => {
    expect(swipeThreshold(300)).toBe(75);
    expect(swipeThreshold(400)).toBe(96);
    expect(swipeThreshold(1200)).toBe(96);
  });
});

describe('swipeProgress', () => {
  it('goes from 0 at rest to 1 at the threshold', () => {
    expect(swipeProgress(0, 400)).toBe(0);
    expect(swipeProgress(48, 400)).toBe(0.5);
    expect(swipeProgress(-48, 400)).toBe(0.5);
    expect(swipeProgress(96, 400)).toBe(1);
  });

  it('stays at 1 beyond the threshold', () => {
    expect(swipeProgress(-300, 400)).toBe(1);
  });

  it('is 0 while the width is unknown', () => {
    expect(swipeProgress(0, 0)).toBe(0);
    expect(swipeProgress(50, 0)).toBe(0);
  });
});

describe('neighbourOffset', () => {
  it('keeps the neighbour glued to the side the finger comes from', () => {
    expect(neighbourOffset(-100, 400)).toBe(300);
    expect(neighbourOffset(100, 400)).toBe(-300);
    expect(neighbourOffset(-400, 400)).toBe(0);
    expect(neighbourOffset(400, 400)).toBe(0);
  });
});
