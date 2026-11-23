import { describe, expect, it } from 'vitest';
import {
  addFreshSelection,
  pickerActionText,
  pickerNotices,
  pickerSubtitle,
} from '../src/downloads/pickerView';
import type { PlaylistListing } from '../src/downloads/playlistReader';

const t = (key: string, params?: Record<string, string | number>) =>
  params ? `${key}:${JSON.stringify(params)}` : key;

const listing = (over: Partial<PlaylistListing> = {}): PlaylistListing => ({
  title: 'x',
  author: '',
  entries: [],
  totalCount: null,
  complete: true,
  unavailable: 0,
  ...over,
});

describe('pickerSubtitle', () => {
  it('joins author and song count', () => {
    expect(pickerSubtitle('Ana', 12, t)).toBe('Ana · dl.songsCount:{"count":12}');
  });
  it('shows only the author without a total', () => {
    expect(pickerSubtitle('Ana', null, t)).toBe('Ana');
  });
  it('is empty with nothing', () => {
    expect(pickerSubtitle(undefined, null, t)).toBe('');
  });
});

describe('pickerActionText', () => {
  it('sends the link when asked', () => {
    expect(pickerActionText(t, true, 3, false)).toBe('send.sendPlaylist');
  });
  it('downloads on the phone', () => {
    expect(pickerActionText(t, false, 3, true)).toBe('dl.downloadAll:{"count":3}');
  });
  it('sends otherwise', () => {
    expect(pickerActionText(t, false, 3, false)).toBe('pick.send:{"count":3}');
  });
});

describe('pickerNotices', () => {
  it('is partial only when done loading, incomplete and with a total', () => {
    expect(pickerNotices(listing({ complete: false, totalCount: 50 }), false, 1000).partial).toBe(
      true,
    );
    expect(pickerNotices(listing({ complete: false, totalCount: 50 }), true, 1000).partial).toBe(
      false,
    );
    expect(pickerNotices(listing({ complete: false }), false, 1000).partial).toBe(false);
    expect(pickerNotices(listing({ totalCount: 50 }), false, 1000).partial).toBe(false);
  });
  it('flags a total above the maximum', () => {
    expect(pickerNotices(listing({ totalCount: 1001 }), false, 1000).overLimit).toBe(true);
    expect(pickerNotices(listing({ totalCount: 1000 }), false, 1000).overLimit).toBe(false);
    expect(pickerNotices(null, false, 1000)).toEqual({ partial: false, overLimit: false });
  });
});

describe('addFreshSelection', () => {
  it('ticks new ids up to the maximum', () => {
    const seen = new Set<string>();
    const next = addFreshSelection(new Set(), seen, ['a', 'b', 'c'], 2);
    expect(next).toEqual(new Set(['a', 'b']));
    expect(seen).toEqual(new Set(['a', 'b', 'c']));
  });
  it('keeps what the user unticked', () => {
    const seen = new Set(['a', 'b']);
    const next = addFreshSelection(new Set(['b']), seen, ['a', 'b', 'c'], 10);
    expect(next).toEqual(new Set(['b', 'c']));
  });
  it('returns null when nothing is new', () => {
    expect(addFreshSelection(new Set(['a']), new Set(['a']), ['a'], 10)).toBeNull();
  });
});
