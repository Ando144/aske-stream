import { describe, expect, it } from 'vitest';
import type { MonthStats } from '@aske/shared/groups';
import { buildGroupRanking } from '../src/groups/ranking';

function stats(
  tracks: Array<[string, string, number]>,
  artists: Array<[string, number]> = [],
): MonthStats {
  return {
    month: '2026-11',
    minutes: 0,
    plays: 0,
    topTracks: tracks.map(([title, artist, plays]) => ({ title, artist, plays, minutes: 0 })),
    topArtists: artists.map(([artist, plays]) => ({ artist, plays, minutes: 0 })),
  };
}

describe('buildGroupRanking', () => {
  it('returns empty lists for no members', () => {
    expect(buildGroupRanking([], 10)).toEqual({ tracks: [], artists: [] });
  });

  it('sums plays and counts listeners', () => {
    const r = buildGroupRanking(
      [stats([['Song', 'Band', 3]]), stats([['Song', 'Band', 2]]), stats([['Other', 'X', 1]])],
      10,
    );
    expect(r.tracks[0]).toEqual({ title: 'Song', artist: 'Band', plays: 5, listeners: 2 });
    expect(r.tracks).toHaveLength(2);
  });

  it('groups ignoring case and outer spaces, showing the first spelling', () => {
    const r = buildGroupRanking(
      [stats([], [['Band', 2]]), stats([], [[' band ', 1]]), stats([], [['BAND', 1]])],
      10,
    );
    expect(r.artists).toEqual([{ artist: 'Band', plays: 4, listeners: 3 }]);
  });

  it('breaks ties by listeners and then by name', () => {
    const r = buildGroupRanking(
      [
        stats([['B', 'x', 2]]),
        stats([['A', 'x', 1]]),
        stats([['A', 'x', 1]]),
        stats([['C', 'x', 2]]),
      ],
      10,
    );
    expect(r.tracks.map((t) => t.title)).toEqual(['A', 'B', 'C']);
  });

  it('cuts at topSize', () => {
    const many = Array.from({ length: 5 }, (_, i): [string, string, number] => [`S${i}`, 'a', i]);
    expect(buildGroupRanking([stats(many)], 3).tracks).toHaveLength(3);
  });
});
