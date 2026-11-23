import { describe, expect, it } from 'vitest';
import { LONG_TRACK_MS, buildStudyQueue, isCalmTrack } from '../src/study/queue';

type T = Parameters<typeof buildStudyQueue>[0][number];
const t = (id: string, title = 'Song', over: Partial<T> = {}): T => ({
  id,
  title,
  artist: 'Band',
  album: 'Disc',
  durationMs: 180_000,
  kind: 'music',
  ...over,
});

describe('isCalmTrack', () => {
  it('matches by word and by duration', () => {
    expect(isCalmTrack(t('1', 'Lofi beats'))).toBe(true);
    expect(isCalmTrack(t('2', 'Música para ESTUDIO'))).toBe(true);
    expect(isCalmTrack(t('3', 'Rock it'))).toBe(false);
    expect(isCalmTrack(t('4', 'Rock it', { durationMs: LONG_TRACK_MS }))).toBe(true);
  });
});

describe('buildStudyQueue', () => {
  const lib = [t('a'), t('b'), t('p', 'Podcast', { kind: 'podcast' })];

  it('uses the library without podcasts', () => {
    expect(buildStudyQueue(lib, [], { kind: 'library' })).toEqual({
      ids: ['a', 'b'],
      fellBack: false,
    });
  });

  it('keeps playlist order, drops duplicates and podcasts', () => {
    const pl = [{ id: 'x', trackIds: ['b', 'p', 'a', 'b'] }];
    expect(buildStudyQueue(lib, pl, { kind: 'playlist', id: 'x' })).toEqual({
      ids: ['b', 'a'],
      fellBack: false,
    });
  });

  it('falls back when the playlist is missing or empty', () => {
    const empty = [{ id: 'x', trackIds: [] }];
    expect(buildStudyQueue(lib, [], { kind: 'playlist', id: 'x' }).fellBack).toBe(true);
    expect(buildStudyQueue(lib, empty, { kind: 'playlist', id: 'x' })).toEqual({
      ids: ['a', 'b'],
      fellBack: true,
    });
  });

  it('falls back when there are fewer than 10 calm tracks', () => {
    const few = Array.from({ length: 9 }, (_, i) => t(`c${i}`, 'piano'));
    expect(buildStudyQueue([...few, t('z')], [], { kind: 'calm' }).fellBack).toBe(true);
  });

  it('uses calm tracks when there are enough', () => {
    const calm = Array.from({ length: 10 }, (_, i) => t(`c${i}`, 'piano'));
    const res = buildStudyQueue([...calm, t('z')], [], { kind: 'calm' });
    expect(res.fellBack).toBe(false);
    expect(res.ids).toHaveLength(10);
  });
});
