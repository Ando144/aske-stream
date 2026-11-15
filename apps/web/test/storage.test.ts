import { describe, expect, it } from 'vitest';
import { titleFromFileName } from '../src/storage/importFiles';
import { formatSongSize } from '../src/views/SetupView';

describe('titleFromFileName', () => {
  it.each([
    [
      '03 - Berri Txarrak - Lemak, aingurak.mp3',
      { artist: 'Berri Txarrak', title: 'Lemak, aingurak' },
    ],
    ['01 Itsasoa.flac', { artist: '', title: 'Itsasoa' }],
    ['Mikel_Laboa_-_Txoria_Txori.ogg', { artist: 'Mikel Laboa', title: 'Txoria Txori' }],
    ['Song.m4a', { artist: '', title: 'Song' }],
  ])('%s', (name, expected) => {
    expect(titleFromFileName(name)).toEqual(expected);
  });
});

describe('storage size guide', () => {
  it('estimates ~4 MB per song', () => {
    expect(formatSongSize(100)).toBe('≈ 400 MB');
    expect(formatSongSize(1000)).toMatch(/≈ 4 GB/);
    expect(formatSongSize(2500)).toMatch(/≈ 10 GB/);
  });
});
