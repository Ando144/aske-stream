import { LIMITS } from '@aske/shared';
import { loadValue, savePref } from '../lib/storage';
import { useLibrary } from '../stores/library';
import type { LocalTrack } from '../storage/types';
import {
  arrangeImportedPlaylist,
  importsToKeep,
  uniquePlaylistName,
  type PlaylistImport,
} from './batch';
import type { JobStatus } from './types';

/** Playlists being imported: what YouTube lists, so late downloads still land in order. */

const IMPORTS_KEY = 'downloads-imports-v1';
const SYNC_DELAY_MS = 4000;

const normalizeName = (name: string) => name.trim().toLowerCase();

let importsCache: PlaylistImport[] | null = null;
function readImports(): PlaylistImport[] {
  importsCache ??= loadValue<PlaylistImport[]>(IMPORTS_KEY, []);
  return importsCache;
}
function writeImports(next: PlaylistImport[]) {
  importsCache = next;
  savePref(IMPORTS_KEY, next);
}

let indexedTracks: unknown = null;
let index = new Map<string, LocalTrack>();

/** videoId -> track, rebuilt only when the library's tracks object changes. */
export function findInLibrary(videoId: string): LocalTrack | undefined {
  const { tracks } = useLibrary.getState();
  if (tracks !== indexedTracks) {
    indexedTracks = tracks;
    index = new Map();
    for (const tr of Object.values(tracks)) {
      if (tr.source === 'youtube' && tr.sourceRef) index.set(tr.sourceRef, tr);
    }
  }
  return index.get(videoId);
}

/** Playlist that receives an import; creates it, or "Name (n)" when asked for a new one. */
export async function resolvePlaylist(
  rawName: string,
  mode: 'merge' | 'new',
): Promise<string | null> {
  const lib = useLibrary.getState();
  let name = rawName.slice(0, LIMITS.nameMax);
  const same = lib.playlists.find((p) => normalizeName(p.name) === normalizeName(name));
  if (same && mode === 'merge') return same.id;
  if (same) {
    name = uniquePlaylistName(
      name,
      lib.playlists.map((p) => p.name),
      LIMITS.nameMax,
    );
  }
  return (await lib.createPlaylist(name))?.id ?? null;
}

export function rememberImport(playlistId: string, videoIds: string[]): void {
  const previous = readImports().find((i) => i.playlistId === playlistId);
  const merged = previous ? [...new Set([...videoIds, ...previous.videoIds])] : videoIds;
  writeImports([
    ...readImports().filter((i) => i.playlistId !== playlistId),
    { playlistId, videoIds: merged },
  ]);
}

/** Makes the playlist hold every imported song that is in the library, in YouTube order. */
export async function syncImport(playlistId: string): Promise<void> {
  const lib = useLibrary.getState();
  const playlist = lib.playlists.find((p) => p.id === playlistId);
  const entry = readImports().find((i) => i.playlistId === playlistId);
  if (!entry) return;
  if (!playlist) {
    writeImports(readImports().filter((i) => i.playlistId !== playlistId));
    return;
  }
  const wanted = arrangeImportedPlaylist(
    entry.videoIds,
    playlist.trackIds,
    (videoId) => findInLibrary(videoId)?.id,
    LIMITS.playlistMaxTracks,
  );
  const have = new Set(playlist.trackIds);
  const missing = wanted.filter((id) => !have.has(id));
  if (missing.length) await lib.addToPlaylist(playlistId, missing, true);
  const after = useLibrary.getState().playlists.find((p) => p.id === playlistId);
  const same =
    after &&
    after.trackIds.length === wanted.length &&
    after.trackIds.every((id, i) => id === wanted[i]);
  if (!same) await useLibrary.getState().reorderPlaylist(playlistId, wanted);
}

let syncTimer: ReturnType<typeof setTimeout> | undefined;
const pendingVideoIds = new Set<string>();
const flushingVideoIds = new Set<string>();

/** A song became available: sync the imports that list it, grouped after 4 s without news. */
export function scheduleImportSync(videoId: string): void {
  pendingVideoIds.add(videoId);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => void flushImportSync(), SYNC_DELAY_MS);
}

async function runFlush(): Promise<void> {
  const videoIds = [...pendingVideoIds];
  pendingVideoIds.clear();
  for (const v of videoIds) flushingVideoIds.add(v);
  try {
    const affected = readImports().filter((i) => i.videoIds.some((v) => videoIds.includes(v)));
    for (const entry of affected) await syncImport(entry.playlistId);
  } finally {
    for (const v of videoIds) flushingVideoIds.delete(v);
  }
}

let flushChain: Promise<void> = Promise.resolve();

/** Runs the pending sync now (e.g. when the queue empties). Calls never overlap. */
export function flushImportSync(): Promise<void> {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = undefined;
  // Failures of earlier flushes reach their own caller, not the next one.
  const run = flushChain.then(runFlush, runFlush);
  flushChain = run.catch(() => undefined);
  return run;
}

/** Flushes pending syncs, then prunes imports using the jobs read after the flush. */
export async function settleImports(
  getJobs: () => readonly { videoId: string; status: JobStatus }[],
): Promise<void> {
  await flushImportSync();
  pruneImports(getJobs());
}

/** Forget imports whose songs are all finished: nothing left to add to the playlist. */
export function pruneImports(jobs: readonly { videoId: string; status: JobStatus }[]): void {
  const current = readImports();
  const keptByJobs = new Set(importsToKeep(current, jobs));
  // An import whose sync is queued or running must survive until that sync finishes.
  const kept = current.filter(
    (i) =>
      keptByJobs.has(i) ||
      i.videoIds.some((v) => pendingVideoIds.has(v) || flushingVideoIds.has(v)),
  );
  if (kept.length !== current.length) writeImports(kept);
}
