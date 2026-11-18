import { describe, expect, it } from 'vitest';
import {
  docFingerprint,
  emptyDoc,
  mergeDocs,
  parseDoc,
  pruneDeleted,
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

  it('prunes deletion marks older than 180 days but keeps recent ones', () => {
    const day = 24 * 3600 * 1000;
    const now = 1_000 * day;
    expect(pruneDeleted({ old: now - 200 * day, recent: now - 10 * day }, now)).toEqual({
      recent: now - 10 * day,
    });
  });

  it('mergeDocs prunes old marks after filtering, so recent deletions still apply', () => {
    const day = 24 * 3600 * 1000;
    const now = 1_000 * day;
    const a = { ...emptyDoc(), tracks: { old: track('old', 1), new: track('new', 1) } };
    const b = { ...emptyDoc(), deleted: { old: now - 200 * day, new: now - 10 * day } };
    const merged = mergeDocs(a, b, now);
    expect(merged.tracks.new).toBeUndefined();
    expect(merged.tracks.old).toBeUndefined();
    expect(Object.keys(merged.deleted)).toEqual(['new']);
  });

  describe('folders', () => {
    const folder = (id: string, name: string, updatedAt: number) => ({
      id,
      name,
      createdAt: 1,
      updatedAt,
    });
    const playlist = (id: string, folderId: string | null) => ({
      id,
      name: id,
      description: '',
      trackIds: [],
      createdAt: 1,
      updatedAt: 5,
      folderId,
    });

    it('a folder deleted on one device does not come back and frees its playlists', () => {
      const a = {
        ...emptyDoc(),
        folders: { f: folder('f', 'Rock', 3) },
        playlists: { p: playlist('p', 'f') },
      };
      const b = { ...emptyDoc(), deleted: { f: 9 } };
      for (const merged of [mergeDocs(a, b), mergeDocs(b, a)]) {
        expect(merged.folders.f).toBeUndefined();
        expect(merged.playlists.p!.folderId).toBeNull();
      }
    });

    it('the most recent rename wins', () => {
      const a = { ...emptyDoc(), folders: { f: folder('f', 'Old', 1) } };
      const b = { ...emptyDoc(), folders: { f: folder('f', 'New', 2) } };
      expect(mergeDocs(a, b).folders.f!.name).toBe('New');
      expect(mergeDocs(b, a).folders.f!.name).toBe('New');
    });

    it('reads an old library.json without folders', () => {
      const { folders: _f, ...old } = emptyDoc();
      expect(parseDoc(JSON.stringify(old)).folders).toEqual({});
    });

    it('keeps position through parseDoc and the newest folder wins with its position', () => {
      const a = { ...emptyDoc(), folders: { f: { ...folder('f', 'A', 1), position: 0 } } };
      const b = { ...emptyDoc(), folders: { f: { ...folder('f', 'A', 2), position: 3 } } };
      expect(parseDoc(JSON.stringify(a)).folders.f!.position).toBe(0);
      expect(mergeDocs(a, b).folders.f!.position).toBe(3);
      expect(mergeDocs(b, a).folders.f!.position).toBe(3);
    });

    it('the fingerprint changes after reordering', () => {
      const a = { ...emptyDoc(), folders: { f: { ...folder('f', 'A', 1), position: 0 } } };
      const b = { ...emptyDoc(), folders: { f: { ...folder('f', 'A', 2), position: 1 } } };
      expect(docFingerprint(a)).not.toBe(docFingerprint(b));
    });

    it('the fingerprint changes when a folder is renamed', () => {
      const a = { ...emptyDoc(), folders: { f: folder('f', 'A', 1) } };
      const b = { ...emptyDoc(), folders: { f: folder('f', 'B', 2) } };
      expect(docFingerprint(a)).not.toBe(docFingerprint(b));
    });
  });

  it('reads damaged or foreign files as an empty library', () => {
    expect(parseDoc('not json').tracks).toEqual({});
    expect(parseDoc('{"hello":1}').tracks).toEqual({});
    const ok = parseDoc(JSON.stringify({ ...emptyDoc(), tracks: { a: track('a', 1) } }));
    expect(Object.keys(ok.tracks)).toEqual(['a']);
  });
});
