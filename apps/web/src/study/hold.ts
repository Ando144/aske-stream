export const HOLD_MS = 30_000;

export interface HoldState {
  pressedAt: number | null;
}

export function press(s: HoldState, now: number): HoldState {
  return s.pressedAt === null ? { pressedAt: now } : s;
}

export function release(): HoldState {
  return { pressedAt: null };
}

export function holdProgress(s: HoldState, now: number, holdMs: number = HOLD_MS): number {
  if (s.pressedAt === null) return 0;
  return Math.min(1, Math.max(0, (now - s.pressedAt) / holdMs));
}

export function holdDone(s: HoldState, now: number, holdMs: number = HOLD_MS): boolean {
  return holdProgress(s, now, holdMs) >= 1;
}
