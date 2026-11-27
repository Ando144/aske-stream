/** Amber artwork drawn for anything that has no cover of its own. */
export type ArtKind = 'song' | 'playlist' | 'podcast';

const HUE_MIN = 24;
const HUE_SPAN = 21; // 24..44
/** Dark enough to stay readable on the darkest stop (lightness 46 %). */
const INK = 'hsl(30, 90%, 9%)';

/** FNV-1a: stable across sessions and devices. */
export function hashSeed(seed: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193);
  }
  return hash >>> 0;
}

export function artColors(seed: string): { from: string; to: string; angle: number; ink: string } {
  const hash = hashSeed(seed);
  const pick = (shift: number, span: number) => (hash >>> shift) % span;
  const hsl = (hue: number, lightness: number) => `hsl(${hue}, 82%, ${lightness}%)`;
  return {
    from: hsl(HUE_MIN + pick(0, HUE_SPAN), 58 + pick(8, 13)),
    to: hsl(HUE_MIN + pick(16, HUE_SPAN), 46 + pick(24, 9)),
    angle: 105 + pick(4, 8) * 15,
    ink: INK,
  };
}
