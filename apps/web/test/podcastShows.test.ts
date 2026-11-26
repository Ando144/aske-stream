import { describe, expect, it } from 'vitest';
import { episodeNumber, groupShows, showNameOf } from '../src/podcasts/shows';
import type { LocalTrack } from '../src/storage/types';

const UNKNOWN = 'Artista desconocido';

function episode(id: string, patch: Partial<LocalTrack> = {}): LocalTrack {
  return {
    id,
    title: id,
    artist: '',
    album: 'Show',
    durationMs: 60_000,
    hasCover: false,
    createdAt: 1,
    likedAt: null,
    kind: 'podcast',
    locations: { cloudflare: true },
    ...patch,
  } as LocalTrack;
}

const idsOf = (tracks: LocalTrack[]) => groupShows(tracks, UNKNOWN)[0]!.episodes.map((e) => e.id);

describe('showNameOf', () => {
  it('uses the album, then the artist, and is empty without both', () => {
    expect(showNameOf(episode('a', { album: ' Serie ', artist: 'Canal' }))).toBe('Serie');
    expect(showNameOf(episode('a', { album: '  ', artist: 'Canal' }))).toBe('Canal');
    expect(showNameOf(episode('a', { album: '', artist: '' }))).toBe('');
  });
});

describe('episodeNumber', () => {
  it.each([
    ['Episodio 3', 3],
    ['Ep. 12: la vuelta', 12],
    ['ep7', 7],
    ['Episode 4', 4],
    ['Capítulo 5', 5],
    ['CAP. 6', 6],
    ['Chapter 8', 8],
    ['Part 9', 9],
    ['Parte 10', 10],
    ['Atala 11', 11],
    ['13. atala', 13],
    ['#14 Entrevista', 14],
    ['E15 - Charla', 15],
    ['S01E16', 16],
    ['Especial 2024, episodio 17', 17],
    ['#45 Entrevista (parte 2)', 45],
  ])('reads the number in "%s"', (title, expected) => {
    expect(episodeNumber(title)).toBe(expected);
  });

  it.each([
    'Charla sin número',
    'Lo mejor de 2023',
    'Parte 2024',
    '#1999',
    'Step 3 to success',
    'The 5 rules',
  ])('finds no number in "%s"', (title) => {
    expect(episodeNumber(title)).toBeNull();
  });
});

describe('groupShows', () => {
  it('puts episode 3 before episode 12', () => {
    const tracks = [
      episode('twelve', { title: 'Episodio 12', createdAt: 1 }),
      episode('three', { title: 'Episodio 3', createdAt: 2 }),
    ];
    expect(idsOf(tracks)).toEqual(['three', 'twelve']);
  });

  it('puts episodes without a number last, oldest download first', () => {
    const tracks = [
      episode('new', { title: 'Bonus', createdAt: 30 }),
      episode('two', { title: 'Ep 2', createdAt: 40 }),
      episode('old', { title: 'Trailer', createdAt: 10 }),
      episode('one', { title: 'Ep 1', createdAt: 50 }),
    ];
    expect(idsOf(tracks)).toEqual(['one', 'two', 'old', 'new']);
  });

  it('orders episodes with the same number by download date', () => {
    const tracks = [
      episode('later', { title: 'Ep 1', createdAt: 2 }),
      episode('earlier', { title: 'Ep 1', createdAt: 1 }),
    ];
    expect(idsOf(tracks)).toEqual(['earlier', 'later']);
  });

  it('joins spellings and shows the most frequent one', () => {
    const shows = groupShows(
      [
        episode('a', { album: 'mi serie' }),
        episode('b', { album: 'Mi Serie' }),
        episode('c', { album: 'Mi Serie' }),
      ],
      UNKNOWN,
    );
    expect(shows).toHaveLength(1);
    expect(shows[0]).toMatchObject({ key: 'mi serie', name: 'Mi Serie' });
    expect(shows[0]!.episodes).toHaveLength(3);
  });

  it('groups by artist without an album, and under the unknown name without both', () => {
    const shows = groupShows(
      [episode('a', { album: '', artist: 'Canal' }), episode('b', { album: '', artist: '' })],
      UNKNOWN,
    );
    expect(shows.map((s) => s.name)).toEqual([UNKNOWN, 'Canal']);
  });

  it('sorts shows from A to Z, reading numbers as numbers', () => {
    const shows = groupShows(
      ['Zeta', 'Serie 10', 'árbol', 'Serie 2'].map((album) => episode(album, { album })),
      UNKNOWN,
    );
    expect(shows.map((s) => s.name)).toEqual(['árbol', 'Serie 2', 'Serie 10', 'Zeta']);
  });

  it('joins two shows when one is renamed like the other', () => {
    const tracks = [episode('a', { album: 'Uno' }), episode('b', { album: 'Dos' })];
    expect(groupShows(tracks, UNKNOWN)).toHaveLength(2);
    const renamed = tracks.map((tr) => (tr.id === 'a' ? { ...tr, album: 'dos' } : tr));
    expect(groupShows(renamed, UNKNOWN)).toHaveLength(1);
  });

  it('leaves music out and does not reorder the given list', () => {
    const tracks = [
      episode('b', { title: 'Ep 2' }),
      episode('song', { kind: 'music' }),
      episode('a', { title: 'Ep 1' }),
    ];
    expect(idsOf(tracks)).toEqual(['a', 'b']);
    expect(tracks.map((tr) => tr.id)).toEqual(['b', 'song', 'a']);
  });
});
