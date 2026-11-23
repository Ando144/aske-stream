import { describe, expect, it } from 'vitest';
import { HOLD_MS, holdDone, holdProgress, press, release } from '../src/study/hold';

describe('hold to exit', () => {
  it('progresses from 0 to 1', () => {
    const s = press(release(), 1000);
    expect(holdProgress(s, 1000)).toBe(0);
    expect(holdProgress(s, 1000 + HOLD_MS / 2)).toBe(0.5);
    expect(holdProgress(s, 1000 + HOLD_MS * 2)).toBe(1);
    expect(holdDone(s, 1000 + HOLD_MS - 1)).toBe(false);
    expect(holdDone(s, 1000 + HOLD_MS)).toBe(true);
  });

  it('release resets and a second press does not restart', () => {
    const s = press(release(), 1000);
    expect(press(s, 5000).pressedAt).toBe(1000);
    expect(release()).toEqual({ pressedAt: null });
    expect(holdProgress(release(), 9999)).toBe(0);
    expect(holdDone(release(), 9999)).toBe(false);
  });

  it('accepts a custom duration', () => {
    expect(holdProgress(press(release(), 0), 500, 1000)).toBe(0.5);
  });
});
