/** Pure rules of a horizontal swipe made with a finger. */

/** Swipes starting this close to a side belong to the system "back" gesture. */
const EDGE_PX = 24;
const AXIS_RATIO = 1.6;
const LONG_PX = 96;
const LONG_WIDTH_SHARE = 0.25;
const FLICK_PX = 40;
const FLICK_PX_PER_MS = 0.5;

export interface SwipeSample {
  dx: number;
  dy: number;
  /** Duration of the gesture. */
  ms: number;
  /** Width of the screen. */
  width: number;
  /** Horizontal screen position where the finger went down. */
  startX: number;
}

export type SwipeDirection = 'left' | 'right';

/** Distance from which a swipe counts however slow it is. */
export function swipeThreshold(width: number): number {
  return Math.min(LONG_PX, width * LONG_WIDTH_SHARE);
}

/** How close a drag is to the threshold, from 0 to 1. */
export function swipeProgress(dx: number, width: number): number {
  const threshold = swipeThreshold(width);
  return threshold > 0 ? Math.min(1, Math.abs(dx) / threshold) : 0;
}

/** Position of the incoming content, which stays one width away from the dragged one. */
export function neighbourOffset(dx: number, width: number): number {
  return dx < 0 ? dx + width : dx - width;
}

export function swipeDecision({ dx, dy, ms, width, startX }: SwipeSample): SwipeDirection | null {
  if (startX < EDGE_PX || startX > width - EDGE_PX) return null;
  const distance = Math.abs(dx);
  if (distance <= AXIS_RATIO * Math.abs(dy)) return null;
  const isLong = distance >= swipeThreshold(width);
  const isFlick = distance >= FLICK_PX && distance / ms > FLICK_PX_PER_MS;
  if (!isLong && !isFlick) return null;
  return dx < 0 ? 'left' : 'right';
}
