import type { Playlist, Station, Track } from '@aske/shared';
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
  stations: Record<string, DocStation>;
  /** id → when it was deleted. */
  deleted: Record<string, number>;
}

export const emptyDoc = (): LibraryDoc => ({
  format: 'aske-library',
  version: 1,
  tracks: {},
  playlists: {},
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

export function mergeDocs(a: LibraryDoc, b: LibraryDoc): LibraryDoc {
  const deleted: Record<string, number> = { ...a.deleted };
  for (const [id, at] of Object.entries(b.deleted)) deleted[id] = Math.max(deleted[id] ?? 0, at);
  const tracks = mergeMap(a.tracks, b.tracks, deleted);
  const playlists = mergeMap(a.playlists, b.playlists, deleted);
  // A playlist never points at a song that no longer exists.
  for (const [id, pl] of Object.entries(playlists)) {
    const kept = pl.trackIds.filter((t) => tracks[t]);
    if (kept.length !== pl.trackIds.length) playlists[id] = { ...pl, trackIds: kept };
  }
  return {
    ...emptyDoc(),
    tracks,
    playlists,
    stations: mergeMap(a.stations, b.stations, deleted),
    deleted,
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
  for (const ch of `${stamp(d.tracks)}|${stamp(d.playlists)}|${stamp(d.stations)}|${del}`) {
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
