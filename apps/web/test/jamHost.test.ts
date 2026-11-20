import type { JamItemView, JamSnapshot } from '@aske/shared/hub';
import { describe, expect, it } from 'vitest';
import { libraryByVideoId, nextReadyItem, songsToPrepare } from '../src/hub/jamHost';

const song = (videoId: string) => ({ videoId, title: videoId, artist: 'a' });
const item = (videoId: string): JamItemView => ({
  id: `i-${videoId}`,
  song: song(videoId),
  addedBy: 'x',
  votes: 0,
  votedByMe: false,
  mine: false,
  addedAt: 0,
});
const snap = (...ids: string[]): JamSnapshot => ({
  code: 'ABCDEF',
  hostName: 'h',
  expiresAt: 0,
  nowPlaying: null,
  queue: ids.map(item),
  members: [],
});

describe('libraryByVideoId', () => {
  it('maps only youtube tracks', () => {
    const map = libraryByVideoId([
      { id: 't1', source: 'youtube', sourceRef: 'AAAAAAAAAAA' },
      { id: 't2', source: 'upload', sourceRef: 'BBBBBBBBBBB' },
    ]);
    expect([...map]).toEqual([['AAAAAAAAAAA', 't1']]);
  });
});

describe('nextReadyItem', () => {
  it('skips songs that are not ready and keeps snapshot order', () => {
    const ready = new Map([
      ['C', 't3'],
      ['B', 't2'],
    ]);
    expect(nextReadyItem(snap('A', 'B', 'C'), ready)?.song.videoId).toBe('B');
  });
  it('returns null when nothing is ready', () => {
    expect(nextReadyItem(snap('A'), new Map())).toBeNull();
  });
});

describe('songsToPrepare', () => {
  it('excludes songs in the library, in flight and duplicates', () => {
    const out = songsToPrepare(
      snap('A', 'B', 'C', 'D', 'D'),
      new Map([['A', 't']]),
      new Set(['B']),
    );
    expect(out.map((s) => s.videoId)).toEqual(['C', 'D']);
  });
});
