import { describe, expect, it } from 'vitest';
import { nextFolderPosition, reorderFolders, sortFolders, type Folder } from '../src/index';

function folder(id: string, name: string, position?: number | null, updatedAt = 1): Folder {
  return { id, name, createdAt: 1, updatedAt, position };
}

const ids = (list: readonly Folder[]) => list.map((f) => f.id);

describe('sortFolders', () => {
  it('puts unordered folders first by name, ignoring case', () => {
    const out = sortFolders([folder('z', 'Zeta'), folder('b', 'beta'), folder('a', 'Alfa')]);
    expect(ids(out)).toEqual(['a', 'b', 'z']);
  });

  it('puts ordered folders after, by position, ties by name', () => {
    const out = sortFolders([
      folder('p2', 'A', 2),
      folder('u', 'Zeta'),
      folder('p1', 'B', 1),
      folder('p1b', 'A', 1),
      folder('n', 'Null', null),
    ]);
    expect(ids(out)).toEqual(['n', 'u', 'p1b', 'p1', 'p2']);
  });

  it('does not mutate the input', () => {
    const input = [folder('b', 'B', 1), folder('a', 'A', 0)];
    sortFolders(input);
    expect(ids(input)).toEqual(['b', 'a']);
  });
});

describe('nextFolderPosition', () => {
  it('is 0 without positions', () => {
    expect(nextFolderPosition([])).toBe(0);
    expect(nextFolderPosition([folder('a', 'A'), folder('b', 'B', null)])).toBe(0);
  });

  it('is the maximum plus one, with gaps or nulls', () => {
    expect(nextFolderPosition([folder('a', 'A', 0), folder('b', 'B', 5), folder('c', 'C')])).toBe(
      6,
    );
  });
});

describe('reorderFolders', () => {
  const base = [folder('a', 'A', 0, 10), folder('b', 'B', 1, 10), folder('c', 'C', 2, 10)];

  it('assigns positions 0..n-1 and reports only the changed ones', () => {
    const out = reorderFolders(base, ['c', 'a', 'b'], 99);
    expect(ids(out.folders)).toEqual(['c', 'a', 'b']);
    expect(out.folders.map((f) => f.position)).toEqual([0, 1, 2]);
    expect(ids(out.changed)).toEqual(['c', 'a', 'b']);
    expect(out.changed.every((f) => f.updatedAt === 99)).toBe(true);
  });

  it('keeps updatedAt of folders that do not move', () => {
    const out = reorderFolders(base, ['a', 'c', 'b'], 99);
    expect(ids(out.changed)).toEqual(['c', 'b']);
    expect(out.folders.find((f) => f.id === 'a')!.updatedAt).toBe(10);
  });

  it('puts unlisted folders after, in their previous order', () => {
    const out = reorderFolders(base, ['c'], 99);
    expect(ids(out.folders)).toEqual(['c', 'a', 'b']);
  });

  it('ignores unknown and repeated ids', () => {
    const out = reorderFolders(base, ['b', 'nope', 'b', 'a'], 99);
    expect(ids(out.folders)).toEqual(['b', 'a', 'c']);
  });

  it('does not mutate the input', () => {
    reorderFolders(base, ['c', 'b', 'a'], 99);
    expect(base.map((f) => f.position)).toEqual([0, 1, 2]);
    expect(base[0]!.updatedAt).toBe(10);
  });
});
