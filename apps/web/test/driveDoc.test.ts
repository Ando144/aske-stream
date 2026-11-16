import { describe, expect, it } from 'vitest';
import {
  docFingerprint,
  emptyDoc,
  mergeDocs,
  parseDoc,
  sameDoc,
  type DocTrack,
} from '../src/storage/drive/doc';

const track = (id: string, updatedAt: number, extra: Partial<DocTrack> = {}): DocTrack => ({
  id,
  title: id,
  artist: '',
  album: '',
  durationMs: 1000,
  sizeBytes: 10,
  bitrateKbps: null,
  hasCover: false,
  kind: 'music',
  source: 'youtube',
  sourceRef: id,
  likedAt: null,
  createdAt: 1,
  audioFileId: `f-${id}`,
  coverFileId: null,
  mime: 'audio/webm',
  updatedAt,
  ...extra,
});

describe('Drive library merge', () => {
  it('keeps songs added on either device', () => {
    const phone = { ...emptyDoc(), tracks: { a: track('a', 10) } };
    const laptop = { ...emptyDoc(), tracks: { b: track('b', 20) } };
    expect(Object.keys(mergeDocs(phone, laptop).tracks).sort()).toEqual(['a', 'b']);
  });

  it('the most recent change wins (a like on the phone, a rename on the laptop)', () => {
    const phone = { ...emptyDoc(), tracks: { a: track('a', 30, { likedAt: 30 }) } };
    const laptop = { ...emptyDoc(), tracks: { a: track('a', 20, { title: 'renamed' }) } };
    expect(mergeDocs(phone, laptop).tracks.a!.likedAt).toBe(30);
    expect(mergeDocs(laptop, phone).tracks.a!.likedAt).toBe(30);
  });

  it('a deletion is final, even against a later like on another device', () => {
    const deleted = { ...emptyDoc(), deleted: { a: 50 } };
    const stale = { ...emptyDoc(), tracks: { a: track('a', 40) } };
    expect(mergeDocs(stale, deleted).tracks.a).toBeUndefined();
    const likedLater = { ...emptyDoc(), tracks: { a: track('a', 60, { likedAt: 60 }) } };
    expect(mergeDocs(deleted, likedLater).tracks.a).toBeUndefined();
    expect(mergeDocs(likedLater, deleted).tracks.a).toBeUndefined();
  });

  it('playlists drop songs that were deleted', () => {
    const a = {
      ...emptyDoc(),
      tracks: { x: track('x', 1), y: track('y', 1) },
      playlists: {
        p: {
          id: 'p',
          name: 'P',
          description: '',
          trackIds: ['x', 'y'],
          createdAt: 1,
          updatedAt: 5,
        },
      },
    };
    const b = { ...emptyDoc(), deleted: { y: 9 } };
    expect(mergeDocs(a, b).playlists.p!.trackIds).toEqual(['x']);
  });

  it('merging is order-independent and the fingerprint tracks changes', () => {
    const a = { ...emptyDoc(), tracks: { a: track('a', 1) }, deleted: { z: 3 } };
    const b = { ...emptyDoc(), tracks: { b: track('b', 2) } };
    expect(sameDoc(mergeDocs(a, b), mergeDocs(b, a))).toBe(true);
    const changed = mergeDocs(a, { ...emptyDoc(), tracks: { a: track('a', 9) } });
    expect(docFingerprint(changed)).not.toBe(docFingerprint(a));
  });

  it('reads damaged or foreign files as an empty library', () => {
    expect(parseDoc('not json').tracks).toEqual({});
    expect(parseDoc('{"hello":1}').tracks).toEqual({});
    const ok = parseDoc(JSON.stringify({ ...emptyDoc(), tracks: { a: track('a', 1) } }));
    expect(Object.keys(ok.tracks)).toEqual(['a']);
  });
});
