import { describe, expect, it } from 'vitest';
import { artColors, hashSeed } from '../src/lib/generatedArt';

const hueOf = (color: string) => Number(/^hsl\((\d+)/.exec(color)?.[1]);

describe('hashSeed', () => {
  it('is a stable unsigned 32-bit number', () => {
    const hash = hashSeed('Song|Artist');
    expect(hashSeed('Song|Artist')).toBe(hash);
    expect(Number.isInteger(hash)).toBe(true);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(2 ** 32);
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});

describe('artColors', () => {
  const seeds = Array.from({ length: 50 }, (_, i) => `Song ${i}|Artist ${i}`);

  it('gives the same colours for the same seed', () => {
    expect(artColors('Song|Artist')).toEqual(artColors('Song|Artist'));
  });

  it('always stays within the amber hues', () => {
    for (const seed of [...seeds, '', 'ñandú 東京']) {
      const { from, to } = artColors(seed);
      for (const hue of [hueOf(from), hueOf(to)]) {
        expect(hue).toBeGreaterThanOrEqual(24);
        expect(hue).toBeLessThanOrEqual(44);
      }
    }
  });

  it('varies between seeds', () => {
    const combinations = new Set(seeds.map((seed) => JSON.stringify(artColors(seed))));
    expect(combinations.size).toBeGreaterThanOrEqual(10);
  });
});
