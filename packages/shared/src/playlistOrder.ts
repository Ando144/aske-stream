import type { EpochMs, Playlist } from './index';

const inContainer = (p: Playlist, folderId: string | null) => (p.folderId ?? null) === folderId;

const byCreated = (a: Playlist, b: Playlist) => a.createdAt - b.createdAt;

/**
 * Pinned first (pinnedAt desc); then unordered (position null) by createdAt asc; then position asc
 * (tie: createdAt). Returns a new array.
 */
export function sortPlaylists(playlists: readonly Playlist[]): Playlist[] {
  const pinned = playlists
    .filter((p) => p.pinnedAt != null)
    .sort((a, b) => b.pinnedAt! - a.pinnedAt!);
  const rest = playlists.filter((p) => p.pinnedAt == null);
  const unordered = rest.filter((p) => p.position == null).sort(byCreated);
  const ordered = rest
    .filter((p) => p.position != null)
    .sort((a, b) => a.position! - b.position! || byCreated(a, b));
  return [...pinned, ...unordered, ...ordered];
}

/** Max position + 1 among playlists of that container; 0 if none. */
export function nextPlaylistPosition(
  playlists: readonly Playlist[],
  folderId: string | null,
): number {
  let max = -1;
  for (const p of playlists) {
    if (inContainer(p, folderId) && p.position != null && p.position > max) max = p.position;
  }
  return max + 1;
}

export interface PlaylistReorder {
  /** All input playlists, in sortPlaylists order. */
  playlists: Playlist[];
  /** Only those whose position changed (with updatedAt = now). */
  changed: Playlist[];
}

/**
 * Only touches playlists of that container: orderedIds first, the rest in sortPlaylists order;
 * position = index. Unknown, repeated or other-container ids are ignored.
 */
export function reorderPlaylists(
  playlists: readonly Playlist[],
  folderId: string | null,
  orderedIds: readonly string[],
  now: EpochMs,
): PlaylistReorder {
  const current = sortPlaylists(playlists.filter((p) => inContainer(p, folderId)));
  const byId = new Map(current.map((p) => [p.id, p]));
  const picked = new Set<string>();
  for (const id of orderedIds) if (byId.has(id)) picked.add(id);
  const sequence = [...picked, ...current.map((p) => p.id).filter((id) => !picked.has(id))];

  const changed: Playlist[] = [];
  const moved = new Map<string, Playlist>();
  sequence.forEach((id, position) => {
    const playlist = byId.get(id)!;
    if (playlist.position === position) return;
    const next = { ...playlist, position, updatedAt: now };
    changed.push(next);
    moved.set(id, next);
  });
  const merged = playlists.map((p) => moved.get(p.id) ?? p);
  return { playlists: sortPlaylists(merged), changed };
}
