export interface PlayRecord {
  id: string;
  trackId: string;
  title: string;
  artist: string; // '' when unknown
  album: string;
  startedAt: number; // epoch ms
  listenedSec: number;
  durationSec: number;
  /** true = ended before the threshold (skipped). Excluded from minutes, tops and streaks. */
  skipped: boolean;
}

export type RecapPeriod =
  | { kind: 'month'; year: number; month: number } // month 1-12
  | { kind: 'year'; year: number };

export interface TopTrack {
  title: string;
  artist: string;
  plays: number;
  minutes: number;
}
export interface TopArtist {
  artist: string;
  plays: number;
  minutes: number;
}
export interface RecapSummary {
  plays: number;
  skipped: number;
  minutes: number;
  distinctTracks: number;
  distinctArtists: number;
  activeDays: number;
  longestStreakDays: number;
  topTracks: TopTrack[];
  topArtists: TopArtist[];
}

const TOP_SIZE = 5;
const DAY_MS = 86_400_000;

/** Local time, half-open range [from, to) in epoch ms. */
export function periodRange(p: RecapPeriod): { from: number; to: number } {
  if (p.kind === 'year') {
    return { from: new Date(p.year, 0, 1).getTime(), to: new Date(p.year + 1, 0, 1).getTime() };
  }
  return {
    from: new Date(p.year, p.month - 1, 1).getTime(),
    to: new Date(p.year, p.month, 1).getTime(),
  };
}

/** Moves the period by `delta` months or years. */
export function shiftPeriod(p: RecapPeriod, delta: number): RecapPeriod {
  if (p.kind === 'year') return { kind: 'year', year: p.year + delta };
  const d = new Date(p.year, p.month - 1 + delta, 1);
  return { kind: 'month', year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function currentPeriod(kind: RecapPeriod['kind'], now: number): RecapPeriod {
  const d = new Date(now);
  if (kind === 'year') return { kind: 'year', year: d.getFullYear() };
  return { kind: 'month', year: d.getFullYear(), month: d.getMonth() + 1 };
}

interface Group {
  title: string;
  artist: string;
  plays: number;
  sec: number;
}

const byPlaysThenMinutes = (a: Group, b: Group, nameA: string, nameB: string): number =>
  b.plays - a.plays || b.sec - a.sec || nameA.localeCompare(nameB);

function accumulate(map: Map<string, Group>, key: string, r: PlayRecord): void {
  const g = map.get(key);
  if (g) {
    g.plays += 1;
    g.sec += r.listenedSec;
  } else {
    map.set(key, { title: r.title, artist: r.artist, plays: 1, sec: r.listenedSec });
  }
}

const toMinutes = (sec: number): number => Math.round(sec / 60);

function topTracksOf(map: Map<string, Group>, topSize: number): TopTrack[] {
  return [...map.values()]
    .sort((a, b) => byPlaysThenMinutes(a, b, `${a.title}|${a.artist}`, `${b.title}|${b.artist}`))
    .slice(0, topSize)
    .map((g) => ({ title: g.title, artist: g.artist, plays: g.plays, minutes: toMinutes(g.sec) }));
}

function topArtistsOf(map: Map<string, Group>, topSize: number): TopArtist[] {
  return [...map.values()]
    .sort((a, b) => byPlaysThenMinutes(a, b, a.artist, b.artist))
    .slice(0, topSize)
    .map((g) => ({ artist: g.artist, plays: g.plays, minutes: toMinutes(g.sec) }));
}

/** Local calendar day as an integer, so consecutive days differ by exactly 1 (DST-safe). */
function dayNumber(epochMs: number): number {
  const d = new Date(epochMs);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS;
}

function longestStreak(days: Set<number>): number {
  let best = 0;
  for (const day of days) {
    if (days.has(day - 1)) continue; // not the start of a run
    let len = 1;
    while (days.has(day + len)) len += 1;
    best = Math.max(best, len);
  }
  return best;
}

/** Only records inside the period are used. */
export function buildRecap(
  records: PlayRecord[],
  period: RecapPeriod,
  topSize: number = TOP_SIZE,
): RecapSummary {
  const { from, to } = periodRange(period);
  const tracks = new Map<string, Group>();
  const artists = new Map<string, Group>();
  const days = new Set<number>();
  let plays = 0;
  let skipped = 0;
  let totalSec = 0;

  for (const r of records) {
    if (r.startedAt < from || r.startedAt >= to) continue;
    if (r.skipped) {
      skipped += 1;
      continue;
    }
    plays += 1;
    totalSec += r.listenedSec;
    days.add(dayNumber(r.startedAt));
    const artistKey = r.artist.trim().toLowerCase();
    accumulate(tracks, `${r.title.trim().toLowerCase()}|${artistKey}`, r);
    if (artistKey) accumulate(artists, artistKey, r);
  }

  return {
    plays,
    skipped,
    minutes: toMinutes(totalSec),
    distinctTracks: tracks.size,
    distinctArtists: artists.size,
    activeDays: days.size,
    longestStreakDays: longestStreak(days),
    topTracks: topTracksOf(tracks, topSize),
    topArtists: topArtistsOf(artists, topSize),
  };
}
