import type { LocalTrack } from '../storage/types';
import { normalizeText } from './format';

/** Songs of one library grouped by normalised title. */
type TitleIndex = Map<string, LocalTrack[]>;

// Ranking screens look up many rows against the same library object.
const cache = new WeakMap<Record<string, LocalTrack>, TitleIndex>();

function titleIndex(tracks: Record<string, LocalTrack>): TitleIndex {
  const cached = cache.get(tracks);
  if (cached) return cached;
  const index: TitleIndex = new Map();
  for (const track of Object.values(tracks)) {
    const key = normalizeText(track.title);
    const group = index.get(key);
    if (group) group.push(track);
    else index.set(key, [track]);
  }
  cache.set(tracks, index);
  return index;
}

/** The library song behind a title and artist coming from statistics. */
export function findTrackByTitle(
  tracks: Record<string, LocalTrack>,
  title: string,
  artist: string,
): LocalTrack | null {
  const sameTitle = titleIndex(tracks).get(normalizeText(title)) ?? [];
  const wanted = normalizeText(artist);
  const exact = sameTitle.find((track) => normalizeText(track.artist) === wanted);
  if (exact) return exact;
  return sameTitle.length === 1 ? (sameTitle[0] ?? null) : null;
}
