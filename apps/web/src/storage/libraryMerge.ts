import type { LocalTrack } from './types';

/**
 * Adds the songs kept only on this phone to the home's list (newest first), placing each one by
 * creation date without reordering the home's own songs. The home wins on repeated ids.
 */
export function mergeExtras(
  homeTracks: readonly LocalTrack[],
  extras: readonly LocalTrack[],
): LocalTrack[] {
  const known = new Set(homeTracks.map((tr) => tr.id));
  const pending = extras
    .filter((tr) => !known.has(tr.id))
    .sort((a, b) => b.createdAt - a.createdAt);
  const merged: LocalTrack[] = [];
  let next = 0;
  for (const track of homeTracks) {
    while (next < pending.length && pending[next]!.createdAt > track.createdAt) {
      merged.push(pending[next++]!);
    }
    merged.push(track);
  }
  return merged.concat(pending.slice(next));
}
