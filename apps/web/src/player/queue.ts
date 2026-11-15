/** Pure queue helpers (unit-tested). */
import { shuffled } from '../offline/planner';

export type RepeatMode = 'off' | 'all' | 'one';

/**
 * "Real" shuffle: a Fisher–Yates permutation of the whole queue, with the
 * song that is playing now kept first so toggling shuffle never interrupts it.
 */
export function shuffleKeepingFirst(
  ids: readonly string[],
  firstId: string | null,
  random: () => number = Math.random,
): string[] {
  if (firstId === null || !ids.includes(firstId)) return shuffled(ids, random);
  const rest = [...ids];
  rest.splice(rest.indexOf(firstId), 1);
  return [firstId, ...shuffled(rest, random)];
}

/**
 * New shuffled order for the next lap of "repeat all", avoiding playing the
 * last song of the previous lap twice in a row.
 */
export function reshuffleForNextLap(
  ids: readonly string[],
  lastPlayed: string | null,
  random: () => number = Math.random,
): string[] {
  const next = shuffled(ids, random);
  if (next.length > 1 && next[0] === lastPlayed) {
    const swap = 1 + Math.floor(random() * (next.length - 1));
    [next[0], next[swap]] = [next[swap]!, next[0]!];
  }
  return next;
}

/** Index after the current one, or `null` when playback should stop. */
export function nextIndex(length: number, index: number, repeat: RepeatMode): number | null {
  if (length === 0) return null;
  if (index + 1 < length) return index + 1;
  return repeat === 'all' ? 0 : null;
}

export function previousIndex(length: number, index: number, repeat: RepeatMode): number {
  if (length === 0) return 0;
  if (index > 0) return index - 1;
  return repeat === 'all' ? length - 1 : 0;
}

/** Inserts ids right after `index`, removing earlier duplicates of them after the cursor. */
export function insertAfter(
  queue: readonly string[],
  index: number,
  ids: readonly string[],
): string[] {
  const head = queue.slice(0, index + 1);
  const tail = queue.slice(index + 1).filter((id) => !ids.includes(id));
  return [...head, ...ids, ...tail];
}
