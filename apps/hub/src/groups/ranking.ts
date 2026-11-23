import type { GroupStats, MonthStats } from '@aske/shared/groups';

interface Tally<T> {
  item: T;
  plays: number;
  listeners: number;
}

const norm = (text: string) => text.trim().toLowerCase();

function tally<T extends { plays: number }>(
  perMember: T[][],
  keyOf: (item: T) => string,
): Array<Tally<T>> {
  const totals = new Map<string, Tally<T>>();
  for (const items of perMember) {
    const seen = new Set<string>();
    for (const item of items) {
      const key = keyOf(item);
      const entry = totals.get(key) ?? { item, plays: 0, listeners: 0 };
      entry.plays += item.plays;
      if (!seen.has(key)) entry.listeners += 1;
      seen.add(key);
      totals.set(key, entry);
    }
  }
  return [...totals.values()];
}

function sortAndCut<T>(
  entries: Array<Tally<T>>,
  nameOf: (item: T) => string,
  topSize: number,
): Array<Tally<T>> {
  return entries
    .sort(
      (a, b) =>
        b.plays - a.plays ||
        b.listeners - a.listeners ||
        nameOf(a.item).localeCompare(nameOf(b.item)),
    )
    .slice(0, topSize);
}

/** Sums plays and counts listeners across members; the first spelling seen is displayed. */
export function buildGroupRanking(stats: MonthStats[], topSize: number): GroupStats['ranking'] {
  const tracks = tally(
    stats.map((s) => s.topTracks),
    (t) => `${norm(t.title)}|${norm(t.artist)}`,
  );
  const artists = tally(
    stats.map((s) => s.topArtists),
    (a) => norm(a.artist),
  );
  return {
    tracks: sortAndCut(tracks, (t) => `${t.title} ${t.artist}`, topSize).map((e) => ({
      title: e.item.title,
      artist: e.item.artist,
      plays: e.plays,
      listeners: e.listeners,
    })),
    artists: sortAndCut(artists, (a) => a.artist, topSize).map((e) => ({
      artist: e.item.artist,
      plays: e.plays,
      listeners: e.listeners,
    })),
  };
}
