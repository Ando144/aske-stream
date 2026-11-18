import { LIMITS, type Folder, type Playlist } from '@aske/shared';

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
  /** Sorted by name (localeCompare, sensitivity 'base'). */
  folders: { folder: Folder; playlists: Playlist[] }[];
  /** Playlists without a folder or whose folder no longer exists. */
  loose: Playlist[];
}

const byCreatedAt = (a: Playlist, b: Playlist) => a.createdAt - b.createdAt;

export function groupPlaylists(playlists: Playlist[], folders: Folder[]): PlaylistGroups {
  const known = new Set(folders.map((f) => f.id));
  const sorted = [...playlists].sort(byCreatedAt);
  return {
    folders: [...folders]
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
      .map((folder) => ({ folder, playlists: sorted.filter((p) => p.folderId === folder.id) })),
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
  | { kind: 'merge'; targetId: string; sourceId: string }
  | null;

export function dropAction(
  activeId: string,
  overId: string | null,
  playlists: Playlist[],
): DropResult {
  if (!overId || !activeId.startsWith('pl:')) return null;
  const dragged = playlists.find((p) => p.id === activeId.slice(3));
  if (!dragged) return null;
  const current = dragged.folderId ?? null;

  if (overId === 'root') {
    return current === null ? null : { kind: 'move', playlistId: dragged.id, folderId: null };
  }
  if (overId.startsWith('folder:')) {
    const folderId = overId.slice(7);
    return folderId === current ? null : { kind: 'move', playlistId: dragged.id, folderId };
  }
  if (overId.startsWith('pl:')) {
    const targetId = overId.slice(3);
    const exists = playlists.some((p) => p.id === targetId);
    return exists && targetId !== dragged.id
      ? { kind: 'merge', targetId, sourceId: dragged.id }
      : null;
  }
  return null;
}
