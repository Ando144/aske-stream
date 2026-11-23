const BROWN_LEAK = 0.98;
const BROWN_PEAK = 0.9;

export function whiteNoise(length: number, rng: () => number = Math.random): Float32Array {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i += 1) out[i] = rng() * 2 - 1;
  return out;
}

export function brownNoise(length: number, rng: () => number = Math.random): Float32Array {
  const out = whiteNoise(length, rng);
  let y = 0;
  let peak = 0;
  for (let i = 0; i < length; i += 1) {
    y = BROWN_LEAK * y + (1 - BROWN_LEAK) * out[i]!;
    out[i] = y;
    peak = Math.max(peak, Math.abs(y));
  }
  if (peak === 0) return out;
  const gain = BROWN_PEAK / peak;
  for (let i = 0; i < length; i += 1) out[i]! *= gain;
  return out;
}

/** Crossfades the tail into the head so the buffer loops without a click. */
export function makeSeamless(data: Float32Array, fadeSamples: number): Float32Array {
  const fade = Math.min(Math.floor(fadeSamples), Math.floor(data.length / 2));
  if (fade <= 0) return data.slice();
  const out = data.slice(0, data.length - fade);
  for (let i = 0; i < fade; i += 1) {
    const w = (i + 1) / (fade + 1); // head weight rises from ~0 to ~1
    out[i] = data[i]! * w + data[data.length - fade + i]! * (1 - w);
  }
  return out;
}
