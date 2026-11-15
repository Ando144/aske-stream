import { describe, expect, it } from 'vitest';
import { cleanTitle, metadataFromYoutube, youtubeVideoId } from '../src/metadata';

describe('cleanTitle', () => {
  it.each([
    ['Song Name (Official Music Video)', 'Song Name'],
    ['Song Name [Official Audio]', 'Song Name'],
    ['Song Name (Lyrics)', 'Song Name'],
    ['Song Name (Videoclip Oficial)', 'Song Name'],
    ['Song Name (Remastered 2011)', 'Song Name'],
    ['Song Name | Official Video', 'Song Name'],
    ['Song Name (feat. Someone)', 'Song Name (feat. Someone)'],
    ['Song Name (Live at Bilbao)', 'Song Name (Live at Bilbao)'],
  ])('%s → %s', (input, expected) => {
    expect(cleanTitle(input)).toBe(expected);
  });
});

describe('metadataFromYoutube', () => {
  it('prefers the structured fields of auto-generated music uploads', () => {
    expect(
      metadataFromYoutube({
        id: 'x',
        title: 'Whatever',
        track: 'Txoria Txori',
        artist: 'Mikel Laboa',
        album: 'Bat-Hiru',
        uploader: 'Mikel Laboa - Topic',
      }),
    ).toEqual({ title: 'Txoria Txori', artist: 'Mikel Laboa', album: 'Bat-Hiru' });
  });

  it('splits "Artist - Title" and strips the noise', () => {
    expect(
      metadataFromYoutube({
        id: 'x',
        title: 'Berri Txarrak - Denak ez du balio (Official Video)',
        uploader: 'Label',
      }),
    ).toEqual({ title: 'Denak ez du balio', artist: 'Berri Txarrak', album: '' });
  });

  it('falls back to the uploader as artist', () => {
    expect(
      metadataFromYoutube({ id: 'x', title: 'Just A Title', uploader: 'SomeBandVEVO' }),
    ).toEqual({
      title: 'Just A Title',
      artist: 'SomeBand',
      album: '',
    });
  });
});

describe('youtubeVideoId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=abc', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=10', 'dQw4w9WgXcQ'],
    ['https://music.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/playlist?list=PL123', null],
    ['https://example.com/watch?v=x', null],
    ['not a url', null],
  ])('%s', (input, expected) => {
    expect(youtubeVideoId(input)).toBe(expected);
  });
});
