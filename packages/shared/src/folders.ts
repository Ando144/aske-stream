import type { EpochMs, Folder } from './index';

const byName = (a: Folder, b: Folder) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

/** Unordered folders first (by name), then by position (tie: by name). Returns a new array. */
export function sortFolders(folders: readonly Folder[]): Folder[] {
  const unordered = folders.filter((f) => f.position == null).sort(byName);
  const ordered = folders
    .filter((f) => f.position != null)
    .sort((a, b) => a.position! - b.position! || byName(a, b));
  return [...unordered, ...ordered];
}

/** Max position + 1; 0 when no folder has a position. */
export function nextFolderPosition(folders: readonly Folder[]): number {
  let max = -1;
  for (const f of folders) if (f.position != null && f.position > max) max = f.position;
  return max + 1;
}

export interface FolderReorder {
  /** All folders in the new order, position = index. */
  folders: Folder[];
  /** Only those whose position changed (with updatedAt = now). */
  changed: Folder[];
}

/** orderedIds first (unknown or repeated ids ignored), then the rest in their sortFolders order. */
export function reorderFolders(
  folders: readonly Folder[],
  orderedIds: readonly string[],
  now: EpochMs,
): FolderReorder {
  const current = sortFolders(folders);
  const byId = new Map(current.map((f) => [f.id, f]));
  const picked = new Set<string>();
  for (const id of orderedIds) if (byId.has(id)) picked.add(id);
  const sequence = [...picked, ...current.map((f) => f.id).filter((id) => !picked.has(id))];

  const changed: Folder[] = [];
  const result = sequence.map((id, position) => {
    const folder = byId.get(id)!;
    if (folder.position === position) return folder;
    const moved = { ...folder, position, updatedAt: now };
    changed.push(moved);
    return moved;
  });
  return { folders: result, changed };
}
