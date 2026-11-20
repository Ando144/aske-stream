import { describe, expect, it } from 'vitest';
import { songsFromPlaylist, splitByLibrary } from '../src/hub/sharedList';
import type { LocalTrack } from '../src/storage/types';

function track(id: string, source: string, sourceRef: string | null, title = id): LocalTrack {
  return {
    id,
    title,
    artist: 'Artist',
    durationMs: 1000,
    source,
    sourceRef,
  } as unknown as LocalTrack;
}

const A = 'aaaaaaaaaaa';
const B = 'bbbbbbbbbbb';

describe('songsFromPlaylist', () => {
  it('skips imported files and counts them', () => {
    const tracks = { t1: track('t1', 'youtube', A), t2: track('t2', 'upload', null) };
    const res = songsFromPlaylist(['t1', 't2'], tracks);
    expect(res.songs.map((s) => s.videoId)).toEqual([A]);
    expect(res.skipped).toBe(1);
  });

  it('skips YouTube tracks without a valid reference', () => {
    const tracks = { t1: track('t1', 'youtube', 'short') };
    expect(songsFromPlaylist(['t1'], tracks)).toEqual({ songs: [], skipped: 1 });
  });

  it('removes duplicates and keeps the order', () => {
    const tracks = {
      t1: track('t1', 'youtube', B),
      t2: track('t2', 'youtube', A),
      t3: track('t3', 'youtube', B),
    };
    const res = songsFromPlaylist(['t1', 't2', 't3'], tracks);
    expect(res.songs.map((s) => s.videoId)).toEqual([B, A]);
    expect(res.skipped).toBe(0);
  });

  it('ignores ids that are not in the library', () => {
    expect(songsFromPlaylist(['nope'], {})).toEqual({ songs: [], skipped: 0 });
  });
});

describe('splitByLibrary', () => {
  it('separates the songs you have from the missing ones', () => {
    const tracks = { t1: track('t1', 'youtube', A), t2: track('t2', 'upload', null) };
    const songs = [
      { videoId: A, title: 'A', artist: '' },
      { videoId: B, title: 'B', artist: '' },
    ];
    const res = splitByLibrary(songs, tracks);
    expect(res.have).toEqual(['t1']);
    expect(res.missing.map((s) => s.videoId)).toEqual([B]);
  });
});
