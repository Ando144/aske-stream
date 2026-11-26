/** Podcast episodes grouped into shows. The show of an episode is stored in `album`. */
import { normalizeText } from '../lib/format';
import type { LocalTrack } from '../storage/types';

export interface Show {
  key: string;
  name: string;
  episodes: LocalTrack[];
}

/**
 * "Ep. 3", "Capitulo 3", "#3", "S01E03" and the Basque "3. atala". Titles are normalised first,
 * so accents and capitals do not matter.
 */
const EPISODE_NUMBER =
  /(?:(?<!\p{L})(?:(?:episodio|episode|ep|capitulo|cap|chapter|parte|part|atala)[\s.:#º°-]*|e)|#\s*)(\d+)|(?<!\d)(\d+)[\s.]*atala/gu;

/** A year in a title ("Part 2024") is not an episode number. */
const isYear = (n: number) => n >= 1900 && n <= 2099;

/** Empty when the episode has neither a show nor an artist. */
export function showNameOf(track: LocalTrack): string {
  return track.album.trim() || track.artist.trim();
}

export function episodeNumber(title: string): number | null {
  for (const match of normalizeText(title).matchAll(EPISODE_NUMBER)) {
    const number = Number(match[1] ?? match[2]);
    if (!isYear(number)) return number;
  }
  return null;
}

/** Numbered episodes first (1, 2, 3…), then the rest from the oldest download to the newest. */
function sortEpisodes(episodes: LocalTrack[]): LocalTrack[] {
  return episodes
    .map((track) => ({ track, number: episodeNumber(track.title) ?? Infinity }))
    .sort((a, b) =>
      a.number === b.number ? a.track.createdAt - b.track.createdAt : a.number < b.number ? -1 : 1,
    )
    .map((e) => e.track);
}

function mostFrequent(names: string[]): string {
  const counts = new Map<string, number>();
  for (const name of names) counts.set(name, (counts.get(name) ?? 0) + 1);
  return [...counts].reduce((best, entry) => (entry[1] > best[1] ? entry : best))[0];
}

/** Shows from A to Z; spellings that differ only in accents or capitals are the same show. */
export function groupShows(tracks: LocalTrack[], unknownName: string): Show[] {
  const groups = new Map<string, LocalTrack[]>();
  for (const track of tracks) {
    if (track.kind !== 'podcast') continue;
    const key = normalizeText(showNameOf(track) || unknownName);
    const group = groups.get(key);
    if (group) group.push(track);
    else groups.set(key, [track]);
  }
  return [...groups]
    .map(([key, group]) => {
      const episodes = sortEpisodes(group);
      const name = mostFrequent(episodes.map((e) => showNameOf(e) || unknownName));
      return { key, name, episodes };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}
