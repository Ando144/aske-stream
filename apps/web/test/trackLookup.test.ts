import { describe, expect, it } from 'vitest';
import { findTrackByTitle } from '../src/lib/trackLookup';
import type { LocalTrack } from '../src/storage/types';

function library(...songs: [string, string, string][]): Record<string, LocalTrack> {
  return Object.fromEntries(
    songs.map(([id, title, artist]) => [id, { id, title, artist } as LocalTrack]),
  );
}

describe('findTrackByTitle', () => {
  it('ignores accents and capitals', () => {
    const tracks = library(['a', 'Solamente Tú', 'Pablo Alborán']);
    expect(findTrackByTitle(tracks, 'solamente tu', 'PABLO ALBORAN')?.id).toBe('a');
  });

  it('prefers the exact artist among songs with the same title', () => {
    const tracks = library(['a', 'Home', 'One'], ['b', 'Home', 'Two']);
    expect(findTrackByTitle(tracks, 'Home', 'Two')?.id).toBe('b');
  });

  it('accepts another artist when the title is unique', () => {
    const tracks = library(['a', 'Home', 'One'], ['b', 'Away', 'Two']);
    expect(findTrackByTitle(tracks, 'Home', 'Somebody else')?.id).toBe('a');
  });

  it('gives nothing when the title is ambiguous or unknown', () => {
    const tracks = library(['a', 'Home', 'One'], ['b', 'Home', 'Two']);
    expect(findTrackByTitle(tracks, 'Home', 'Three')).toBeNull();
    expect(findTrackByTitle(tracks, 'Nowhere', 'One')).toBeNull();
  });

  it('sees the songs of a new library object', () => {
    const before = library(['a', 'Home', 'One']);
    expect(findTrackByTitle(before, 'Away', 'Two')).toBeNull();
    const after = { ...before, ...library(['b', 'Away', 'Two']) };
    expect(findTrackByTitle(after, 'Away', 'Two')?.id).toBe('b');
  });
});
