import type { Playlist, Station } from '@aske/shared';
import { ApiError } from '../../api/client';
import { DriveAuthRequired } from '../drive/auth';
import type { Destination, LocalTrack } from '../types';
import { buildCopyPlan, planPlaylists, planStations, type IdMap } from './plan';

export interface CopyEndpoint {
  kind: Destination;
  load(): Promise<{ tracks: LocalTrack[]; playlists: Playlist[]; stations: Station[] }>;
  readAudio(t: LocalTrack): Promise<Blob>;
  readCover(t: LocalTrack): Promise<Blob | null>;
  /** Keeps likedAt (and createdAt where the storage allows it). */
  writeTrack(
    t: LocalTrack,
    audio: Blob,
    cover: Blob | null,
  ): Promise<{ track: LocalTrack; existed: boolean }>;
  createPlaylist(name: string, trackIds: string[]): Promise<unknown>;
  addToPlaylist(id: string, trackIds: string[]): Promise<unknown>;
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

async function copyPlaylists(run: Run, destPlaylists: Playlist[], src: Playlist[]): Promise<void> {
  const { actions, overflow } = planPlaylists(src, destPlaylists, run.map);
  run.progress.playlistOverflow = overflow;
  for (const action of actions) {
    try {
      if (action.kind === 'create') await run.deps.to.createPlaylist(action.name, action.trackIds);
      else await run.deps.to.addToPlaylist(action.playlistId, action.trackIds);
    } catch {
      // A playlist that cannot be written must not stop the rest of the copy.
    }
  }
}

async function copyStations(run: Run, src: Station[], dest: Station[]): Promise<void> {
  for (const s of planStations(src, dest)) {
    try {
      await run.deps.to.saveStation(s);
    } catch {
      // Same: radios are a bonus.
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
    await copyPlaylists(run, dest.playlists, source.playlists);
    await copyStations(run, source.stations, dest.stations);
    emit(run);
  }
  return { progress: run.progress, stopped };
}
