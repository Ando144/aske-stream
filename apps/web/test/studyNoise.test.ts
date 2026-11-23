import { describe, expect, it } from 'vitest';
import { brownNoise, makeSeamless, whiteNoise } from '../src/study/noise';

function seeded(): () => number {
  let s = 12345;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function meanStep(d: Float32Array): number {
  let sum = 0;
  for (let i = 1; i < d.length; i += 1) sum += Math.abs(d[i]! - d[i - 1]!);
  return sum / (d.length - 1);
}

describe('noise', () => {
  it('white noise stays in [-1, 1] and is deterministic with a fixed rng', () => {
    const a = whiteNoise(1000, seeded());
    const b = whiteNoise(1000, seeded());
    expect(a).toEqual(b);
    expect(Math.max(...a)).toBeLessThanOrEqual(1);
    expect(Math.min(...a)).toBeGreaterThanOrEqual(-1);
  });

  it('brown noise is smoother than white and peaks at 0.9', () => {
    const white = whiteNoise(5000, seeded());
    const brown = brownNoise(5000, seeded());
    expect(meanStep(brown)).toBeLessThan(meanStep(white));
    expect(Math.max(...brown.map(Math.abs))).toBeCloseTo(0.9, 5);
  });

  it('makeSeamless leaves a small jump between last and first sample', () => {
    const brown = brownNoise(5000, seeded());
    const loop = makeSeamless(brown, 500);
    expect(loop.length).toBe(4500);
    expect(Math.abs(loop[loop.length - 1]! - loop[0]!)).toBeLessThan(0.2);
  });
});
