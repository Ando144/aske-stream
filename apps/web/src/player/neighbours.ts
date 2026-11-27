/** Which song a swipe on a player would bring, without moving the playback cursor. */
import { nextIndex, previousIndex, type RepeatMode } from './queue';

export interface QueueView {
  currentId: string | null;
  queue: readonly string[];
  context: readonly string[];
  index: number;
  fromQueue: boolean;
  repeat: RepeatMode;
  contextShuffled: boolean;
}

/** Mirrors `step(true)` of the player; `null` also when a reshuffle makes it unknown. */
export function nextTrackId(s: QueueView): string | null {
  if (s.queue.length) return s.queue[0]!;
  const next = nextIndex(s.context.length, s.index, s.repeat);
  if (next === null) return null;
  if (next === 0 && s.contextShuffled && s.context.length > 1) return null;
  return s.context[next] ?? null;
}

/** Mirrors `previous({ skipRestart: true })` of the player. */
export function previousTrackId(s: QueueView): string | null {
  const index = s.fromQueue ? s.index : previousIndex(s.context.length, s.index, s.repeat);
  const id = s.context[index] ?? null;
  return id === s.currentId ? null : id;
}
