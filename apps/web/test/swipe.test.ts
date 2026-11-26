import { describe, expect, it } from 'vitest';
import { swipeDecision, type SwipeSample } from '../src/lib/swipe';

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
