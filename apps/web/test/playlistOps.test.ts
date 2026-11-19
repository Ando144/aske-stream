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
  it('respects folder position, unordered ones first', () => {
    const groups = groupPlaylists(
      [],
      [
        { ...folder('f1', 'A'), position: 1 },
        { ...folder('f2', 'B'), position: 0 },
        folder('f3', 'Z'),
      ],
    );
    expect(groups.folders.map((g) => g.folder.id)).toEqual(['f3', 'f2', 'f1']);
  });

  it('sorts folders by name and playlists by createdAt, keeping empty folders', () => {
    const groups = groupPlaylists(
      [pl('x', { folderId: 'f2', createdAt: 5 }), pl('y', { folderId: 'f2', createdAt: 2 })],
      [folder('f2', 'rock'), folder('f1', 'Ambient'), folder('f3', 'Zeta')],
    );
    expect(groups.folders.map((g) => g.folder.id)).toEqual(['f1', 'f2', 'f3']);
    expect(groups.folders[1]!.playlists.map((p) => p.id)).toEqual(['y', 'x']);
    expect(groups.folders[0]!.playlists).toEqual([]);
  });

  it('orders playlists by pin, then position, inside folders and loose', () => {
    const groups = groupPlaylists(
      [
        pl('a', { createdAt: 1, position: 1 }),
        pl('b', { createdAt: 2, position: 0 }),
        pl('c', { createdAt: 3, pinnedAt: 5 }),
        pl('x', { folderId: 'f', createdAt: 1, position: 1 }),
        pl('y', { folderId: 'f', createdAt: 2, position: 0 }),
      ],
      [folder('f', 'F')],
    );
    expect(groups.loose.map((p) => p.id)).toEqual(['c', 'b', 'a']);
    expect(groups.folders[0]!.playlists.map((p) => p.id)).toEqual(['y', 'x']);
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
  const folders = [folder('F', 'Alpha'), folder('G', 'Beta'), folder('H', 'Gamma')];
  const drop = (a: string, o: string | null) => dropAction(a, o, list, folders);

  it('moves a playlist onto a folder', () => {
    expect(drop('pl:B', 'folder:F')).toEqual({ kind: 'move', playlistId: 'B', folderId: 'F' });
  });

  it('does nothing when it is already in that folder or the folder does not exist', () => {
    expect(drop('pl:A', 'folder:F')).toBeNull();
    expect(drop('pl:B', 'folder:ZZ')).toBeNull();
  });

  it('does nothing when a playlist is dropped on itself or on one of another container', () => {
    expect(drop('pl:B', 'pl:B')).toBeNull();
    expect(drop('pl:B', 'pl:A')).toBeNull();
    expect(drop('pl:B', 'pl:ZZ')).toBeNull();
  });

  it('reorders playlists of the same container', () => {
    expect(drop('pl:B', 'pl:C')).toEqual({
      kind: 'reorderPlaylists',
      folderId: null,
      playlistIds: ['C', 'B'],
    });
    expect(drop('pl:C', 'pl:B')).toEqual({
      kind: 'reorderPlaylists',
      folderId: null,
      playlistIds: ['C', 'B'],
    });
  });

  it('reorders inside a folder and never includes pinned playlists', () => {
    const inside = [
      pl('X', { folderId: 'F', createdAt: 1 }),
      pl('Y', { folderId: 'F', createdAt: 2 }),
      pl('Z', { folderId: 'F', createdAt: 3 }),
      pl('P', { folderId: 'F', createdAt: 4, pinnedAt: 9 }),
    ];
    expect(dropAction('pl:X', 'pl:Z', inside, folders)).toEqual({
      kind: 'reorderPlaylists',
      folderId: 'F',
      playlistIds: ['Y', 'Z', 'X'],
    });
    expect(dropAction('pl:X', 'pl:P', inside, folders)).toBeNull();
    expect(dropAction('pl:P', 'pl:X', inside, folders)).toBeNull();
  });

  it('takes a playlist out of its folder with root', () => {
    expect(drop('pl:A', 'root')).toEqual({ kind: 'move', playlistId: 'A', folderId: null });
    expect(drop('pl:B', 'root')).toBeNull();
  });

  it('reorders folders downwards and upwards', () => {
    expect(drop('folder:F', 'folder:H')).toEqual({
      kind: 'reorderFolders',
      folderIds: ['G', 'H', 'F'],
    });
    expect(drop('folder:H', 'folder:F')).toEqual({
      kind: 'reorderFolders',
      folderIds: ['H', 'F', 'G'],
    });
  });

  it('starts from the sortFolders order', () => {
    const ordered = [
      { ...folder('F', 'Alpha'), position: 1 },
      { ...folder('G', 'Beta'), position: 0 },
    ];
    expect(dropAction('folder:G', 'folder:F', [], ordered)).toEqual({
      kind: 'reorderFolders',
      folderIds: ['F', 'G'],
    });
  });

  it('ignores a folder dropped on itself, root, a playlist or an unknown folder', () => {
    expect(drop('folder:F', 'folder:F')).toBeNull();
    expect(drop('folder:F', 'root')).toBeNull();
    expect(drop('folder:F', 'pl:B')).toBeNull();
    expect(drop('folder:F', 'folder:ZZ')).toBeNull();
    expect(drop('folder:ZZ', 'folder:F')).toBeNull();
  });

  it('ignores missing targets and unknown playlists', () => {
    expect(drop('pl:B', null)).toBeNull();
    expect(drop('pl:ZZ', 'root')).toBeNull();
  });
});
