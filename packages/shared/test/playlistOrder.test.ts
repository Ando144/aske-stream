import { describe, expect, it } from 'vitest';
import { nextPlaylistPosition, reorderPlaylists, sortPlaylists, type Playlist } from '../src/index';

function pl(id: string, extra: Partial<Playlist> = {}): Playlist {
  return {
    id,
    name: id,
    description: '',
    trackIds: [],
    createdAt: 1,
    updatedAt: 10,
    ...extra,
  };
}

const ids = (list: readonly Playlist[]) => list.map((p) => p.id);

describe('sortPlaylists', () => {
  it('puts pinned first, most recently pinned on top', () => {
    const out = sortPlaylists([
      pl('a'),
      pl('p1', { pinnedAt: 5 }),
      pl('p2', { pinnedAt: 9 }),
      pl('b', { position: 0 }),
    ]);
    expect(ids(out)).toEqual(['p2', 'p1', 'a', 'b']);
  });

  it('puts unordered by createdAt, then ordered by position (tie: createdAt)', () => {
    const out = sortPlaylists([
      pl('o2', { position: 2, createdAt: 1 }),
      pl('u2', { createdAt: 7 }),
      pl('o1b', { position: 1, createdAt: 5 }),
      pl('o1a', { position: 1, createdAt: 3 }),
      pl('u1', { createdAt: 2, position: null }),
    ]);
    expect(ids(out)).toEqual(['u1', 'u2', 'o1a', 'o1b', 'o2']);
  });

  it('does not mutate the input', () => {
    const input = [pl('b', { position: 1 }), pl('a', { position: 0 })];
    sortPlaylists(input);
    expect(ids(input)).toEqual(['b', 'a']);
  });
});

describe('nextPlaylistPosition', () => {
  const all = [
    pl('a', { position: 3 }),
    pl('b', { position: 9, folderId: 'f' }),
    pl('c', { folderId: null, position: 1 }),
  ];

  it('counts only the requested container', () => {
    expect(nextPlaylistPosition(all, null)).toBe(4);
    expect(nextPlaylistPosition(all, 'f')).toBe(10);
  });

  it('is 0 when the container has no positions', () => {
    expect(nextPlaylistPosition(all, 'other')).toBe(0);
    expect(nextPlaylistPosition([pl('x')], null)).toBe(0);
  });
});

describe('reorderPlaylists', () => {
  const base = [
    pl('a', { position: 0 }),
    pl('b', { position: 1 }),
    pl('c', { position: 2 }),
    pl('x', { folderId: 'f', position: 0 }),
    pl('y', { folderId: 'f', position: 1 }),
  ];

  it('reorders only the given container and reports changed ones', () => {
    const out = reorderPlaylists(base, null, ['a', 'c', 'b'], 99);
    expect(ids(out.changed)).toEqual(['c', 'b']);
    expect(out.changed.every((p) => p.updatedAt === 99)).toBe(true);
    expect(out.playlists.find((p) => p.id === 'a')!.updatedAt).toBe(10);
    expect(out.playlists).toHaveLength(5);
    expect(out.playlists.find((p) => p.id === 'x')).toBe(base[3]);
    expect(out.playlists.filter((p) => !p.folderId).map((p) => p.id)).toEqual(['a', 'c', 'b']);
  });

  it('puts unlisted ones after and ignores unknown, repeated and foreign ids', () => {
    const out = reorderPlaylists(base, null, ['c', 'nope', 'c', 'x'], 99);
    expect(out.playlists.filter((p) => !p.folderId).map((p) => p.id)).toEqual(['c', 'a', 'b']);
    expect(out.playlists.find((p) => p.id === 'x')!.position).toBe(0);
  });

  it('works inside a folder', () => {
    const out = reorderPlaylists(base, 'f', ['y', 'x'], 99);
    expect(ids(out.changed)).toEqual(['y', 'x']);
    expect(out.playlists.find((p) => p.id === 'y')!.position).toBe(0);
  });

  it('does not mutate the input', () => {
    reorderPlaylists(base, null, ['c', 'b', 'a'], 99);
    expect(base.map((p) => p.position)).toEqual([0, 1, 2, 0, 1]);
  });
});
