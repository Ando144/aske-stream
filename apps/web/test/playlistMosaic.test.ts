import { describe, expect, it } from 'vitest';
import type { Track } from '@aske/shared';
import { mosaicTrackIds } from '../src/lib/playlistMosaic';

function library(covers: Record<string, boolean>): Record<string, Track> {
  return Object.fromEntries(
    Object.entries(covers).map(([id, hasCover]) => [id, { id, hasCover } as Track]),
  );
}

describe('mosaicTrackIds', () => {
  it('is empty for a playlist without songs', () => {
    expect(mosaicTrackIds([], {})).toEqual([]);
  });

  it('shows one song when there are fewer than four', () => {
    const tracks = library({ a: false, b: false });
    expect(mosaicTrackIds(['a', 'b'], tracks)).toEqual(['a']);
  });

  it('prefers the song with a cover when showing only one', () => {
    const tracks = library({ a: false, b: true, c: false });
    expect(mosaicTrackIds(['a', 'b', 'c'], tracks)).toEqual(['b']);
  });

  it('puts the songs with a cover first and fills up to four', () => {
    const tracks = library({ a: false, b: true, c: false, d: true, e: false });
    expect(mosaicTrackIds(['a', 'b', 'c', 'd', 'e'], tracks)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('ignores songs that are no longer in the library', () => {
    const tracks = library({ a: false });
    expect(mosaicTrackIds(['x', 'a', 'y', 'z'], tracks)).toEqual(['a']);
  });
});
