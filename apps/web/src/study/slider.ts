function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number, min: number, max: number, step: number): number {
  return clamp(Math.round((value - min) / step) * step + min, min, max);
}

/** Converts a pointer x position over the track into a slider value. */
export function valueFromX(
  x: number,
  left: number,
  width: number,
  min: number,
  max: number,
  step = 1,
): number {
  if (width <= 0) return min;
  const ratio = clamp((x - left) / width, 0, 1);
  return snap(min + ratio * (max - min), min, max, step);
}

/** New value for a keyboard key, or null when the key does not move the slider. */
export function valueForKey(
  key: string,
  value: number,
  min: number,
  max: number,
  step = 1,
): number | null {
  const deltas: Record<string, number> = {
    ArrowLeft: -step,
    ArrowDown: -step,
    ArrowRight: step,
    ArrowUp: step,
    PageDown: -10 * step,
    PageUp: 10 * step,
  };
  if (key === 'Home') return min;
  if (key === 'End') return max;
  const delta = deltas[key];
  return delta === undefined ? null : clamp(value + delta, min, max);
}
