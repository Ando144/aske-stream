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

export interface PlaybackLists {
  currentId: string | null;
  context: string[];
  original: string[];
  index: number;
  queue: string[];
}

/**
 * Drops deleted songs from the playback lists. When the current song is removed from the
 * context, `index` is left on the previous one so `step()` moves on to the song that followed.
 */
export function withoutTracks(
  s: PlaybackLists,
  removed: ReadonlySet<string>,
): Omit<PlaybackLists, 'currentId'> & { currentRemoved: boolean } {
  const keep = (id: string) => !removed.has(id);
  const removedUpToCursor = s.context.slice(0, s.index + 1).filter((id) => removed.has(id)).length;
  const context = s.context.filter(keep);
  return {
    context,
    original: s.original.filter(keep),
    queue: s.queue.filter(keep),
    index: Math.max(-1, s.index - removedUpToCursor),
    currentRemoved: s.currentId !== null && removed.has(s.currentId),
  };
}

/** Moves one item (drag & drop). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  if (item === undefined) return [...items];
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

/**
 * Data saver: songs that play without mobile data (stored on the device or
 * already in the offline cache) go first, then the ones that must stream.
 * Order inside each group is kept, or shuffled when shuffle is on.
 */
export function orderForDataSaver(
  ids: readonly string[],
  isAvailableOffline: (id: string) => boolean,
  shuffle: boolean,
  random: () => number = Math.random,
): string[] {
  const local = ids.filter(isAvailableOffline);
  const remote = ids.filter((id) => !isAvailableOffline(id));
  return shuffle
    ? [...shuffled(local, random), ...shuffled(remote, random)]
    : [...local, ...remote];
}
