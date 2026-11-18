import type { Folder, Playlist, Station } from '@aske/shared';
import { ApiError } from '../../api/client';
import { DriveAuthRequired } from '../drive/auth';
import type { Destination, LocalTrack } from '../types';
import {
  buildCopyPlan,
  nameKey,
  planFolders,
  planPlaylists,
  planStations,
  type IdMap,
  type PlaylistAction,
} from './plan';

export interface CopyEndpoint {
  kind: Destination;
  load(): Promise<{
    tracks: LocalTrack[];
    playlists: Playlist[];
    folders: Folder[];
    stations: Station[];
  }>;
  readAudio(t: LocalTrack): Promise<Blob>;
  readCover(t: LocalTrack): Promise<Blob | null>;
  /** Keeps likedAt (and createdAt where the storage allows it). */
  writeTrack(
    t: LocalTrack,
    audio: Blob,
    cover: Blob | null,
  ): Promise<{ track: LocalTrack; existed: boolean }>;
  createPlaylist(name: string, trackIds: string[]): Promise<Playlist>;
  addToPlaylist(id: string, trackIds: string[]): Promise<unknown>;
  createFolder(name: string): Promise<Folder>;
  movePlaylist(id: string, folderId: string | null): Promise<unknown>;
  /** null when the playlist has no custom cover (or it cannot be read). */
  readPlaylistCover(pl: Playlist): Promise<Blob | null>;
  setPlaylistCover(id: string, jpeg: Blob): Promise<unknown>;
  saveStation(s: Station): Promise<unknown>;
  /** null = unknown / unlimited. */
  freeBytes(): Promise<number | null>;
}

export type CopyStop = 'cancelled' | 'offline' | 'auth' | 'full' | null;

export interface CopyProgress {
  total: number;
  done: number;
  copied: number;
  already: number;
  unsupported: number;
  failed: string[];
  playlistOverflow: { name: string; count: number }[];
}

export interface RunDeps {
  from: CopyEndpoint;
  to: CopyEndpoint;
  getMap(): Promise<IdMap>;
  saveMap(m: IdMap): Promise<void>;
  shouldStop(): boolean;
  onProgress(p: CopyProgress): void;
  onTrackCopied?(t: LocalTrack): void;
}

export function classifyCopyError(err: unknown): 'offline' | 'auth' | 'full' | 'other' {
  if (err instanceof DriveAuthRequired) return 'auth';
  if (err instanceof ApiError) {
    if (err.status === 401) return 'auth';
    if (err.status === 507 || err.code === 'storage_full') return 'full';
    if (err.status === 0 || err.code === 'network_error') return 'offline';
  }
  const code = (err as { code?: string } | null)?.code;
  if (code === 'drive_full') return 'full';
  if (code === 'network_error') return 'offline';
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  return 'other';
}

interface Run {
  deps: RunDeps;
  map: IdMap;
  progress: CopyProgress;
}

function emit(run: Run): void {
  run.deps.onProgress({ ...run.progress, failed: [...run.progress.failed] });
}

async function copyOne(run: Run, t: LocalTrack): Promise<void> {
  const { from, to } = run.deps;
  const audio = await from.readAudio(t);
  const cover = t.hasCover ? await from.readCover(t) : null;
  const { track, existed } = await to.writeTrack(t, audio, cover);
  run.map[t.id] = track.id;
  await run.deps.saveMap(run.map);
  if (existed) run.progress.already++;
  else {
    run.progress.copied++;
    run.deps.onTrackCopied?.(track);
  }
  run.progress.done++;
}

async function copyTracks(run: Run, todo: LocalTrack[]): Promise<CopyStop> {
  for (const t of todo) {
    if (run.deps.shouldStop()) return 'cancelled';
    try {
      await copyOne(run, t);
    } catch (err) {
      const kind = classifyCopyError(err);
      if (kind !== 'other') return kind;
      run.progress.failed.push(t.title);
      run.progress.done++;
    }
    emit(run);
  }
  return null;
}

/** Creates the missing folders; returns normalized name -> destination folder id. */
async function copyFolders(run: Run, src: Folder[], dest: Folder[]): Promise<Map<string, string>> {
  const ids = new Map(dest.map((f) => [nameKey(f.name), f.id]));
  for (const name of planFolders(src, dest)) {
    try {
      ids.set(nameKey(name), (await run.deps.to.createFolder(name)).id);
    } catch (err) {
      console.warn('Copy: could not create folder', name, err);
    }
  }
  return ids;
}

async function putInFolder(
  run: Run,
  playlistId: string,
  folderName: string | null,
  folderIds: Map<string, string>,
): Promise<void> {
  const folderId = folderName ? folderIds.get(nameKey(folderName)) : undefined;
  if (!folderId) return;
  try {
    await run.deps.to.movePlaylist(playlistId, folderId);
  } catch (err) {
    console.warn('Copy: could not move playlist to its folder', folderName, err);
  }
}

async function copyCover(run: Run, source: Playlist | undefined, destId: string): Promise<void> {
  if (!source) return;
  try {
    const jpeg = await run.deps.from.readPlaylistCover(source);
    if (jpeg) await run.deps.to.setPlaylistCover(destId, jpeg);
  } catch (err) {
    console.warn('Copy: could not copy playlist cover', source.name, err);
  }
}

async function applyAction(
  run: Run,
  action: PlaylistAction,
  src: Playlist[],
  folderIds: Map<string, string>,
): Promise<void> {
  const { to } = run.deps;
  let destId = action.kind === 'add' ? action.playlistId : '';
  if (action.kind === 'create') destId = (await to.createPlaylist(action.name, action.trackIds)).id;
  else if (action.trackIds.length) await to.addToPlaylist(destId, action.trackIds);
  await putInFolder(run, destId, action.folderName, folderIds);
  if (action.copyCover)
    await copyCover(
      run,
      src.find((p) => p.id === action.sourceId),
      destId,
    );
}

async function copyPlaylists(
  run: Run,
  source: { playlists: Playlist[]; folders: Folder[] },
  dest: { playlists: Playlist[]; folders: Folder[] },
): Promise<void> {
  const folderIds = await copyFolders(run, source.folders, dest.folders);
  const { actions, overflow } = planPlaylists(
    source.playlists,
    dest.playlists,
    run.map,
    undefined,
    { src: source.folders, dest: dest.folders },
  );
  run.progress.playlistOverflow = overflow;
  for (const action of actions) {
    try {
      await applyAction(run, action, source.playlists, folderIds);
    } catch (err) {
      console.warn('Copy: could not copy playlist', action.name, err);
    }
  }
}

async function copyStations(run: Run, src: Station[], dest: Station[]): Promise<void> {
  for (const s of planStations(src, dest)) {
    try {
      await run.deps.to.saveStation(s);
    } catch (err) {
      console.warn('Copy: could not save radio', s.name, err);
    }
  }
}

export async function runCopy(
  deps: RunDeps,
): Promise<{ progress: CopyProgress; stopped: CopyStop }> {
  const [source, dest] = await Promise.all([deps.from.load(), deps.to.load()]);
  const plan = buildCopyPlan(source.tracks, dest.tracks, await deps.getMap(), deps.to.kind);
  const run: Run = {
    deps,
    map: { ...(await deps.getMap()), ...plan.already },
    progress: {
      total: source.tracks.length,
      done: Object.keys(plan.already).length + plan.unsupported.length,
      copied: 0,
      already: Object.keys(plan.already).length,
      unsupported: plan.unsupported.length,
      failed: [],
      playlistOverflow: [],
    },
  };
  await deps.saveMap(run.map);
  emit(run);

  const stopped = await copyTracks(run, plan.todo);
  if (!stopped) {
    await copyPlaylists(run, source, dest);
    await copyStations(run, source.stations, dest.stations);
    emit(run);
  }
  return { progress: run.progress, stopped };
}
