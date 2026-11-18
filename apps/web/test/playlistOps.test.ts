import { describe, expect, it } from 'vitest';
import type { Folder, Playlist } from '@aske/shared';
import {
  applyFolderDelete,
  applyMove,
  dropAction,
  groupPlaylists,
  planMerge,
} from '../src/storage/playlistOps';

function pl(id: string, over: Partial<Playlist> = {}): Playlist {
  return {
    id,
    name: id,
    description: '',
    trackIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...over,
  };
}

function folder(id: string, name: string): Folder {
  return { id, name, createdAt: 1, updatedAt: 1 };
}

describe('planMerge', () => {
  it('keeps the target order and appends missing source songs', () => {
    const plan = planMerge(
      pl('a', { trackIds: ['1', '2'] }),
      pl('b', { trackIds: ['3', '2', '4'] }),
    );
    expect(plan).toEqual({ ok: true, trackIds: ['1', '2', '3', '4'], added: 2 });
  });

  it('drops duplicates inside the source', () => {
    const plan = planMerge(pl('a', { trackIds: ['1'] }), pl('b', { trackIds: ['2', '2', '1'] }));
    expect(plan).toEqual({ ok: true, trackIds: ['1', '2'], added: 1 });
  });

  it('refuses to merge a playlist with itself', () => {
    const a = pl('a', { trackIds: ['1'] });
    expect(planMerge(a, a)).toMatchObject({ ok: false, reason: 'same' });
  });

  it('accepts exactly the maximum and rejects one more', () => {
    const ids = (from: number, n: number) => Array.from({ length: n }, (_, i) => `t${from + i}`);
    const target = pl('a', { trackIds: ids(0, 600) });
    expect(planMerge(target, pl('b', { trackIds: ids(600, 400) }))).toMatchObject({ ok: true });
    expect(planMerge(target, pl('b', { trackIds: ids(600, 401) }))).toEqual({
      ok: false,
      reason: 'too_many',
      total: 1001,
      max: 1000,
    });
  });
});

describe('groupPlaylists', () => {
  it('sorts folders by name and playlists by createdAt, keeping empty folders', () => {
    const groups = groupPlaylists(
      [pl('x', { folderId: 'f2', createdAt: 5 }), pl('y', { folderId: 'f2', createdAt: 2 })],
      [folder('f2', 'rock'), folder('f1', 'Ambient'), folder('f3', 'Zeta')],
    );
    expect(groups.folders.map((g) => g.folder.id)).toEqual(['f1', 'f2', 'f3']);
    expect(groups.folders[1]!.playlists.map((p) => p.id)).toEqual(['y', 'x']);
    expect(groups.folders[0]!.playlists).toEqual([]);
  });

  it('sends playlists with a missing folder to loose', () => {
    const groups = groupPlaylists(
      [pl('a', { folderId: 'gone', createdAt: 3 }), pl('b', { createdAt: 1 })],
      [],
    );
    expect(groups.loose.map((p) => p.id)).toEqual(['b', 'a']);
  });
});

describe('applyMove and applyFolderDelete', () => {
  it('moves without mutating the input', () => {
    const input = [pl('a'), pl('b')];
    const out = applyMove(input, 'a', 'f1');
    expect(out[0]!.folderId).toBe('f1');
    expect(out[1]).toBe(input[1]);
    expect(input[0]!.folderId).toBeUndefined();
  });

  it('empties a folder without mutating the input', () => {
    const input = [pl('a', { folderId: 'f1' }), pl('b', { folderId: 'f2' })];
    const out = applyFolderDelete(input, 'f1');
    expect(out[0]!.folderId).toBeNull();
    expect(out[1]).toBe(input[1]);
    expect(input[0]!.folderId).toBe('f1');
  });
});

describe('dropAction', () => {
  const list = [pl('A', { folderId: 'F' }), pl('B'), pl('C')];

  it('moves a playlist onto a folder', () => {
    expect(dropAction('pl:B', 'folder:F', list)).toEqual({
      kind: 'move',
      playlistId: 'B',
      folderId: 'F',
    });
  });

  it('does nothing when it is already in that folder', () => {
    expect(dropAction('pl:A', 'folder:F', list)).toBeNull();
  });

  it('merges onto another playlist, the drop target stays', () => {
    expect(dropAction('pl:B', 'pl:C', list)).toEqual({
      kind: 'merge',
      targetId: 'C',
      sourceId: 'B',
    });
  });

  it('does nothing when dropped on itself', () => {
    expect(dropAction('pl:B', 'pl:B', list)).toBeNull();
  });

  it('takes a playlist out of its folder with root', () => {
    expect(dropAction('pl:A', 'root', list)).toEqual({
      kind: 'move',
      playlistId: 'A',
      folderId: null,
    });
    expect(dropAction('pl:B', 'root', list)).toBeNull();
  });

  it('ignores unknown or missing targets and non-playlist drags', () => {
    expect(dropAction('pl:B', null, list)).toBeNull();
    expect(dropAction('folder:F', 'pl:B', list)).toBeNull();
    expect(dropAction('pl:ZZ', 'root', list)).toBeNull();
    expect(dropAction('pl:B', 'pl:ZZ', list)).toBeNull();
  });
});
