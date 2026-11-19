import { LIMITS, sortFolders, sortPlaylists, type Folder, type Playlist } from '@aske/shared';

export type MergePlan =
  | { ok: true; trackIds: string[]; added: number }
  | { ok: false; reason: 'same' | 'too_many'; total: number; max: number };

/** Target order first, then the source songs not already in it (no repeats). */
export function planMerge(
  target: Playlist,
  source: Playlist,
  max: number = LIMITS.playlistMaxTracks,
): MergePlan {
  if (target.id === source.id) {
    return { ok: false, reason: 'same', total: target.trackIds.length, max };
  }
  const seen = new Set(target.trackIds);
  const missing: string[] = [];
  for (const id of source.trackIds) {
    if (!seen.has(id)) {
      seen.add(id);
      missing.push(id);
    }
  }
  const trackIds = [...target.trackIds, ...missing];
  if (trackIds.length > max) {
    return { ok: false, reason: 'too_many', total: trackIds.length, max };
  }
  return { ok: true, trackIds, added: missing.length };
}

export interface PlaylistGroups {
  /** In sortFolders order. */
  folders: { folder: Folder; playlists: Playlist[] }[];
  /** Playlists without a folder or whose folder no longer exists. */
  loose: Playlist[];
}

export function groupPlaylists(playlists: Playlist[], folders: Folder[]): PlaylistGroups {
  const known = new Set(folders.map((f) => f.id));
  const sorted = sortPlaylists(playlists);
  return {
    folders: sortFolders(folders).map((folder) => ({
      folder,
      playlists: sorted.filter((p) => p.folderId === folder.id),
    })),
    loose: sorted.filter((p) => !p.folderId || !known.has(p.folderId)),
  };
}

export function applyMove(playlists: Playlist[], id: string, folderId: string | null): Playlist[] {
  return playlists.map((p) => (p.id === id ? { ...p, folderId } : p));
}

export function applyFolderDelete(playlists: Playlist[], folderId: string): Playlist[] {
  return playlists.map((p) => (p.folderId === folderId ? { ...p, folderId: null } : p));
}

/** Drag & drop ids: 'pl:<id>', 'folder:<id>', 'root'. */
export type DropResult =
  | { kind: 'move'; playlistId: string; folderId: string | null }
  | { kind: 'reorderFolders'; folderIds: string[] }
  | { kind: 'reorderPlaylists'; folderId: string | null; playlistIds: string[] }
  | null;

function arrayMove<T>(list: T[], from: number, to: number): T[] {
  const out = [...list];
  out.splice(to, 0, out.splice(from, 1)[0]!);
  return out;
}

/** Same container, none pinned: the dragged one takes the place of the one it is dropped on. */
function dropOnPlaylist(dragged: Playlist, overId: string, playlists: Playlist[]): DropResult {
  const over = playlists.find((p) => p.id === overId);
  const folderId = dragged.folderId ?? null;
  if (!over || over.id === dragged.id || (over.folderId ?? null) !== folderId) return null;
  if (dragged.pinnedAt != null || over.pinnedAt != null) return null;
  const ids = sortPlaylists(playlists.filter((p) => (p.folderId ?? null) === folderId))
    .filter((p) => p.pinnedAt == null)
    .map((p) => p.id);
  return {
    kind: 'reorderPlaylists',
    folderId,
    playlistIds: arrayMove(ids, ids.indexOf(dragged.id), ids.indexOf(over.id)),
  };
}

function dropPlaylist(
  playlistId: string,
  overId: string,
  playlists: Playlist[],
  folders: Folder[],
): DropResult {
  const dragged = playlists.find((p) => p.id === playlistId);
  if (!dragged) return null;
  const current = dragged.folderId ?? null;
  if (overId === 'root') {
    return current === null ? null : { kind: 'move', playlistId, folderId: null };
  }
  if (overId.startsWith('pl:')) return dropOnPlaylist(dragged, overId.slice(3), playlists);
  if (!overId.startsWith('folder:')) return null;
  const folderId = overId.slice(7);
  if (folderId === current || !folders.some((f) => f.id === folderId)) return null;
  return { kind: 'move', playlistId, folderId };
}

function dropFolder(folderId: string, overId: string, folders: Folder[]): DropResult {
  if (!overId.startsWith('folder:')) return null;
  const overFolderId = overId.slice(7);
  if (overFolderId === folderId) return null;
  const ids = sortFolders(folders)
    .filter((f) => f.pinnedAt == null)
    .map((f) => f.id);
  const from = ids.indexOf(folderId);
  const to = ids.indexOf(overFolderId);
  if (from < 0 || to < 0) return null;
  return { kind: 'reorderFolders', folderIds: arrayMove(ids, from, to) };
}

export function dropAction(
  activeId: string,
  overId: string | null,
  playlists: Playlist[],
  folders: Folder[],
): DropResult {
  if (!overId) return null;
  if (activeId.startsWith('pl:'))
    return dropPlaylist(activeId.slice(3), overId, playlists, folders);
  if (activeId.startsWith('folder:')) return dropFolder(activeId.slice(7), overId, folders);
  return null;
}
