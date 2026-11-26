import { describe, expect, it } from 'vitest';
import type { GroupStats, MemberMonthStats, RankedTrack } from '@aske/shared/groups';
import { monthSummary } from '../src/groups/summary';

const member = (memberId: string, alias: string, minutes: number): MemberMonthStats => ({
  memberId,
  alias,
  month: '2026-11',
  minutes,
  plays: 0,
  topTracks: [],
  topArtists: [],
});

const track = (title: string, plays: number): RankedTrack => ({
  title,
  artist: 'Artist',
  plays,
  listeners: 1,
});

const stats = (members: MemberMonthStats[], tracks: RankedTrack[] = []): GroupStats => ({
  month: '2026-11',
  members,
  ranking: { tracks, artists: [] },
});

describe('monthSummary', () => {
  it('is empty when nobody shared anything', () => {
    expect(monthSummary(stats([]), 5, 'a')).toEqual({
      minutes: 0,
      sharing: 0,
      total: 5,
      podium: [],
      topTracks: [],
    });
  });

  it('puts a single person first', () => {
    const summary = monthSummary(stats([member('a', 'Leire', 40)]), 3, 'b');
    expect(summary).toMatchObject({ minutes: 40, sharing: 1, total: 3 });
    expect(summary.podium).toEqual([{ alias: 'Leire', minutes: 40, place: 1, isYou: false }]);
  });

  it('keeps the three who listened most, with the total of everybody', () => {
    const members = [
      member('d', 'Maite', 10),
      member('a', 'Ane', 612),
      member('c', 'Leire', 398),
      member('b', 'Iker', 540),
    ];
    const summary = monthSummary(stats(members), 5, 'c');
    expect(summary.minutes).toBe(1560);
    expect(summary.sharing).toBe(4);
    expect(summary.podium.map((p) => [p.alias, p.place])).toEqual([
      ['Ane', 1],
      ['Iker', 2],
      ['Leire', 3],
    ]);
  });

  it('gives the same place to a tie and keeps the order of the Hub', () => {
    const members = [member('a', 'Ane', 100), member('b', 'Iker', 100), member('c', 'Jon', 20)];
    const summary = monthSummary(stats(members), 3, 'a');
    expect(summary.podium.map((p) => [p.alias, p.place])).toEqual([
      ['Ane', 1],
      ['Iker', 1],
      ['Jon', 3],
    ]);
  });

  it('marks which person is you', () => {
    const members = [member('a', 'Ane', 50), member('b', 'Leire', 30)];
    const summary = monthSummary(stats(members), 2, 'b');
    expect(summary.podium.map((p) => p.isYou)).toEqual([false, true]);
  });

  it('counts people without minutes as sharing but leaves them off the podium', () => {
    const summary = monthSummary(stats([member('a', 'Ane', 0)]), 2, 'a');
    expect(summary.sharing).toBe(1);
    expect(summary.podium).toEqual([]);
  });

  it('keeps only the three top songs', () => {
    const tracks = [track('One', 4), track('Two', 3), track('Three', 2), track('Four', 1)];
    const summary = monthSummary(stats([member('a', 'Ane', 5)], tracks), 1, 'a');
    expect(summary.topTracks.map((x) => x.title)).toEqual(['One', 'Two', 'Three']);
  });
});
