import type { Folder, Playlist, Station, Track } from '@aske/shared';
import type { LocalTrack } from '../types';

/**
 * The library stored in Google Drive: one small JSON file ("library.json")
 * next to the songs. Phone and computer may both change it, so every entry
 * carries `updatedAt` and deletions leave a dated mark; merging two copies
 * keeps, for each song / playlist / station, the most recent version, and
 * anything deleted on any device stays deleted.
 * Pure functions, unit-tested.
 */

export interface DocTrack extends Track {
  /** Drive file ids. */
  audioFileId: string;
  coverFileId: string | null;
  mime: string;
  updatedAt: number;
}

export interface DocStation extends Station {
  updatedAt: number;
}

export interface LibraryDoc {
  format: 'aske-library';
  version: 1;
  tracks: Record<string, DocTrack>;
  playlists: Record<string, Playlist>;
  /** Optional in old files; parseDoc always fills it. */
  folders: Record<string, Folder>;
  stations: Record<string, DocStation>;
  /** id → when it was deleted. */
  deleted: Record<string, number>;
}

export const emptyDoc = (): LibraryDoc => ({
  format: 'aske-library',
  version: 1,
  tracks: {},
  playlists: {},
  folders: {},
  stations: {},
  deleted: {},
});

/** Reads a library file; anything unexpected becomes an empty library. */
export function parseDoc(text: string): LibraryDoc {
  try {
    const raw = JSON.parse(text) as Partial<LibraryDoc>;
    if (raw.format !== 'aske-library') return emptyDoc();
    return {
      ...emptyDoc(),
      tracks: raw.tracks ?? {},
      playlists: raw.playlists ?? {},
      folders: raw.folders ?? {},
      stations: raw.stations ?? {},
      deleted: raw.deleted ?? {},
    };
  } catch {
    return emptyDoc();
  }
}

function mergeMap<T extends { updatedAt: number }>(
  a: Record<string, T>,
  b: Record<string, T>,
  deleted: Record<string, number>,
): Record<string, T> {
  const out: Record<string, T> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[id];
    const y = b[id];
    const winner = !x ? y! : !y ? x : y.updatedAt > x.updatedAt ? y : x;
    // Ids are random and never reused, so a deletion is final: a like or a
    // rename made on another device at the same time does not bring the song
    // back (its file is already in the bin).
    if (deleted[id]) continue;
    out[id] = winner;
  }
  return out;
}

const DELETED_MAX_AGE_MS = 180 * 24 * 3600 * 1000;

/**
 * Forgets old deletion marks so the file does not grow forever. Accepted risk: a device
 * that stays offline for more than the max age could bring back something deleted meanwhile.
 */
export function pruneDeleted(
  deleted: Record<string, number>,
  now: number,
  maxAgeMs = DELETED_MAX_AGE_MS,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [id, at] of Object.entries(deleted)) {
    if (now - at <= maxAgeMs) out[id] = at;
  }
  return out;
}

export function mergeDocs(a: LibraryDoc, b: LibraryDoc, now = Date.now()): LibraryDoc {
  const deleted: Record<string, number> = { ...a.deleted };
  for (const [id, at] of Object.entries(b.deleted)) deleted[id] = Math.max(deleted[id] ?? 0, at);
  const tracks = mergeMap(a.tracks, b.tracks, deleted);
  const playlists = mergeMap(a.playlists, b.playlists, deleted);
  // A playlist never points at a song that no longer exists.
  const folders = mergeMap(a.folders, b.folders, deleted);
  for (const [id, pl] of Object.entries(playlists)) {
    const kept = pl.trackIds.filter((t) => tracks[t]);
    const orphan = !!pl.folderId && !folders[pl.folderId];
    if (kept.length !== pl.trackIds.length || orphan) {
      playlists[id] = {
        ...pl,
        trackIds: kept,
        ...(orphan ? { folderId: null } : {}),
      };
    }
  }
  return {
    ...emptyDoc(),
    tracks,
    playlists,
    folders,
    stations: mergeMap(a.stations, b.stations, deleted),
    // Pruned last: the filtering above must still see recent and old marks alike.
    deleted: pruneDeleted(deleted, now),
  };
}

/** Same content (ignores key order). */
export function sameDoc(a: LibraryDoc, b: LibraryDoc): boolean {
  return docFingerprint(a) === docFingerprint(b);
}

/** Cheap revision token: changes whenever any entry changes. */
export function docFingerprint(d: LibraryDoc): string {
  const stamp = (r: Record<string, { updatedAt: number }>) =>
    Object.entries(r)
      .map(([id, v]) => `${id}:${v.updatedAt}`)
      .sort()
      .join(',');
  const del = Object.entries(d.deleted)
    .map(([id, at]) => `${id}:${at}`)
    .sort()
    .join(',');
  let h = 0;
  for (const ch of `${stamp(d.tracks)}|${stamp(d.playlists)}|${stamp(d.folders)}|${stamp(d.stations)}|${del}`) {
    h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  }
  return `d${(h >>> 0).toString(36)}-${Object.keys(d.tracks).length}`;
}

export function toLocalTrack(t: DocTrack): LocalTrack {
  const { audioFileId, coverFileId, updatedAt: _u, ...track } = t;
  return {
    ...track,
    locations: coverFileId
      ? { drive: audioFileId, driveCover: coverFileId }
      : { drive: audioFileId },
  };
}
