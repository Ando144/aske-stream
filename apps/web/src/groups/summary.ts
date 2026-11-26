import type { GroupStats, RankedTrack } from '@aske/shared/groups';

const PODIUM_SIZE = 3;
const TOP_TRACKS = 3;

export interface PodiumPlace {
  alias: string;
  minutes: number;
  /** People with the same minutes share the place: 1, 1, 3. */
  place: number;
  isYou: boolean;
}

export interface MonthSummaryData {
  minutes: number;
  sharing: number;
  total: number;
  podium: PodiumPlace[];
  topTracks: RankedTrack[];
}

/** What the monthly summary of a group shows, out of the stats the Hub added up. */
export function monthSummary(
  stats: GroupStats,
  totalMembers: number,
  youId: string,
): MonthSummaryData {
  const listeners = stats.members
    .map((m) => ({ id: m.memberId, alias: m.alias, minutes: Math.round(m.minutes) }))
    .filter((m) => m.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
  return {
    minutes: Math.round(stats.members.reduce((sum, m) => sum + m.minutes, 0)),
    sharing: stats.members.length,
    total: totalMembers,
    podium: listeners.slice(0, PODIUM_SIZE).map((m) => ({
      alias: m.alias,
      minutes: m.minutes,
      place: 1 + listeners.filter((other) => other.minutes > m.minutes).length,
      isYou: m.id === youId,
    })),
    topTracks: stats.ranking.tracks.slice(0, TOP_TRACKS),
  };
}
