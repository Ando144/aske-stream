import { LIMITS, type Folder, type Playlist, type Station } from '@aske/shared';
import type { Destination, LocalTrack } from '../types';

/** Source track id -> destination track id. */
export type IdMap = Record<string, string>;

const MAX_DURATION_DRIFT_MS = 2000;
const CLOUDFLARE_MIMES = new Set(['audio/ogg', 'audio/webm']);

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function sameSong(a: LocalTrack, b: LocalTrack): boolean {
  if (a.source && a.sourceRef && b.source && b.sourceRef) {
    return a.source === b.source && a.sourceRef === b.sourceRef;
  }
  return (
    normalize(a.title) === normalize(b.title) &&
    normalize(a.artist) === normalize(b.artist) &&
    Math.abs(a.durationMs - b.durationMs) <= MAX_DURATION_DRIFT_MS
  );
}

export function findInDestination(t: LocalTrack, dest: LocalTrack[], map: IdMap): string | null {
  const mapped = map[t.id];
  if (mapped && dest.some((d) => d.id === mapped)) return mapped;
  return dest.find((d) => sameSong(t, d))?.id ?? null;
}

export function canStore(to: Destination, t: LocalTrack): 'ok' | 'format' {
  if (to !== 'cloudflare') return 'ok';
  const base = t.mime.split(';')[0]!.trim().toLowerCase();
  return CLOUDFLARE_MIMES.has(base) ? 'ok' : 'format';
}

export interface CopyPlan {
  /** Oldest first. */
  todo: LocalTrack[];
  already: IdMap;
  unsupported: LocalTrack[];
  todoBytes: number;
}

export function buildCopyPlan(
  src: LocalTrack[],
  dest: LocalTrack[],
  map: IdMap,
  to: Destination,
): CopyPlan {
  const plan: CopyPlan = { todo: [], already: {}, unsupported: [], todoBytes: 0 };
  const ordered = [...src].sort((a, b) => a.createdAt - b.createdAt);
  for (const t of ordered) {
    const found = findInDestination(t, dest, map);
    if (found) plan.already[t.id] = found;
    else if (canStore(to, t) !== 'ok') plan.unsupported.push(t);
    else {
      plan.todo.push(t);
      plan.todoBytes += t.sizeBytes;
    }
  }
  return plan;
}

interface ActionExtras {
  /** Id of the source playlist, to read its cover (names may repeat). */
  sourceId: string;
  /** Folder to put the playlist in (by name); null = leave as is. */
  folderName: string | null;
  copyCover: boolean;
}

export type PlaylistAction =
  | ({ kind: 'create'; name: string; trackIds: string[] } & ActionExtras)
  | ({ kind: 'add'; playlistId: string; name: string; trackIds: string[] } & ActionExtras);

/** Same name regardless of case and surrounding or repeated spaces. */
export function nameKey(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Names of the source folders that the destination does not have yet. */
export function planFolders(src: Folder[], dest: Folder[]): string[] {
  const seen = new Set(dest.map((f) => nameKey(f.name)));
  const out: string[] = [];
  for (const f of src) {
    const key = nameKey(f.name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f.name);
  }
  return out;
}

export interface FolderLists {
  src: Folder[];
  dest: Folder[];
}

function translateIds(trackIds: string[], idMap: IdMap): string[] {
  const out = new Set<string>();
  for (const id of trackIds) {
    const mapped = idMap[id];
    if (mapped) out.add(mapped);
  }
  return [...out];
}

function folderNameOf(pl: Playlist, folders: Folder[]): string | null {
  if (!pl.folderId) return null;
  return folders.find((f) => f.id === pl.folderId)?.name ?? null;
}

function planExisting(
  pl: Playlist,
  existing: Playlist,
  ids: string[],
  max: number,
  folders: FolderLists,
): { action: PlaylistAction | null; overflow: number } {
  const have = new Set(existing.trackIds);
  const missing = ids.filter((id) => !have.has(id));
  const room = Math.max(0, max - existing.trackIds.length);
  const trackIds = missing.slice(0, room);
  const folderName =
    folderNameOf(existing, folders.dest) === null ? folderNameOf(pl, folders.src) : null;
  const copyCover = !!pl.coverAt && !existing.coverAt;
  const worthIt = trackIds.length > 0 || folderName !== null || copyCover;
  const action: PlaylistAction | null = worthIt
    ? {
        kind: 'add',
        sourceId: pl.id,
        playlistId: existing.id,
        name: pl.name,
        trackIds,
        folderName,
        copyCover,
      }
    : null;
  return { action, overflow: missing.length - trackIds.length };
}

function planOne(
  pl: Playlist,
  existing: Playlist | undefined,
  idMap: IdMap,
  max: number,
  folders: FolderLists,
): { action: PlaylistAction | null; overflow: number } {
  const ids = translateIds(pl.trackIds, idMap);
  if (existing) return planExisting(pl, existing, ids, max, folders);
  if (ids.length === 0 && pl.trackIds.length > 0) return { action: null, overflow: 0 };
  const trackIds = ids.slice(0, max);
  return {
    action: {
      kind: 'create',
      sourceId: pl.id,
      name: pl.name,
      trackIds,
      folderName: folderNameOf(pl, folders.src),
      copyCover: !!pl.coverAt,
    },
    overflow: ids.length - trackIds.length,
  };
}

export function planPlaylists(
  src: Playlist[],
  dest: Playlist[],
  idMap: IdMap,
  max: number = LIMITS.playlistMaxTracks,
  folders: FolderLists = { src: [], dest: [] },
): { actions: PlaylistAction[]; overflow: { name: string; count: number }[] } {
  const byName = new Map(dest.map((p) => [nameKey(p.name), p]));
  const actions: PlaylistAction[] = [];
  const overflow: { name: string; count: number }[] = [];
  for (const pl of src) {
    const res = planOne(pl, byName.get(nameKey(pl.name)), idMap, max, folders);
    if (res.action) actions.push(res.action);
    if (res.overflow > 0) overflow.push({ name: pl.name, count: res.overflow });
  }
  return { actions, overflow };
}

export function planStations(src: Station[], dest: Station[]): Station[] {
  const uuids = new Set(dest.map((s) => s.rbUuid).filter(Boolean));
  const urls = new Set(dest.map((s) => s.streamUrl));
  return src.filter((s) => (s.rbUuid ? !uuids.has(s.rbUuid) : !urls.has(s.streamUrl)));
}

export function spaceCheck(
  todoBytes: number,
  freeBytes: number | null,
): { fits: boolean; missingBytes: number } {
  if (freeBytes === null) return { fits: true, missingBytes: 0 };
  const missingBytes = Math.max(0, todoBytes - freeBytes);
  return { fits: missingBytes === 0, missingBytes };
}
