import { create } from 'zustand';
import { kvGet, kvSet } from '../offline/db';
import { getDeviceFile } from '../storage/deviceFiles';
import { DriveAuthRequired } from '../storage/drive/auth';
import { driveHome } from '../storage/drive/home';
import { deviceHome } from '../storage/homes';
import type { LocalTrack } from '../storage/types';
import { useLibrary } from './library';

/**
 * "Copy my music to Google Drive": after switching from "This device" to
 * Google Drive, uploads the songs (with likes) and playlists that were saved
 * on this device. Nothing on the device is deleted. It can be stopped and
 * started again at any time: what is already in Drive is not uploaded twice.
 */

const MAP_KEY = 'copy-to-drive-map';

interface CopyState {
  /** Songs on this device that are not in Drive yet; null = not checked. */
  pending: number | null;
  running: boolean;
  done: number;
  total: number;
  failed: string[];
  finished: boolean;
  check: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => void;
}

let stopRequested = false;

async function copiedMap(): Promise<Record<string, string>> {
  return (await kvGet<Record<string, string>>(MAP_KEY)) ?? {};
}

async function alreadyInDrive(
  track: LocalTrack,
  map: Record<string, string>,
): Promise<string | null> {
  if (map[track.id]) return map[track.id]!;
  if (track.source && track.sourceRef) {
    const found = await driveHome.findBySource(track.source, track.sourceRef);
    if (found) return found.id;
  }
  return null;
}

export const useCopyToDrive = create<CopyState>((set, get) => ({
  pending: null,
  running: false,
  done: 0,
  total: 0,
  failed: [],
  finished: false,

  async check() {
    const snap = await deviceHome.load();
    if (!snap) return;
    const map = await copiedMap();
    let pending = 0;
    for (const tr of snap.tracks) if (!(await alreadyInDrive(tr, map))) pending++;
    set({ pending });
  },

  async start() {
    if (get().running) return;
    stopRequested = false;
    const snap = await deviceHome.load();
    if (!snap) return;
    const map = await copiedMap();
    const todo: LocalTrack[] = [];
    for (const tr of snap.tracks) {
      const existing = await alreadyInDrive(tr, map);
      if (existing) map[tr.id] = existing;
      else todo.push(tr);
    }
    set({ running: true, done: 0, total: todo.length, failed: [], finished: false });
    try {
      // Oldest first, so the library keeps the same order.
      for (const tr of [...todo].reverse()) {
        if (stopRequested) break;
        try {
          const audio = await getDeviceFile('audio', tr.id);
          if (!audio) throw new Error('missing file');
          const cover = tr.hasCover ? await getDeviceFile('covers', tr.id) : null;
          const added = await driveHome.addTrack(
            {
              title: tr.title,
              artist: tr.artist,
              album: tr.album,
              durationMs: tr.durationMs,
              sizeBytes: tr.sizeBytes,
              bitrateKbps: tr.bitrateKbps,
              hasCover: !!cover,
              kind: tr.kind,
              source: tr.source,
              sourceRef: tr.sourceRef,
              mime: tr.mime,
            },
            audio,
            cover,
            { likedAt: tr.likedAt, createdAt: tr.createdAt },
          );
          map[tr.id] = added.id;
          await kvSet(MAP_KEY, map);
          useLibrary.getState().upsertTracks([added]);
        } catch (err) {
          set({ failed: [...get().failed, tr.title] });
          // No internet or no access to Google: stop here, it continues next time.
          if (!navigator.onLine || err instanceof DriveAuthRequired) break;
          const code = (err as { code?: string }).code;
          if (code === 'drive_full' || code === 'network_error') break;
        }
        set({ done: get().done + 1 });
      }

      // Playlists: same name in Drive → add what is missing; otherwise create it.
      if (!stopRequested) {
        const { playlists: drivePlaylists } = (await driveHome.load()) ?? { playlists: [] };
        for (const pl of snap.playlists) {
          const ids = pl.trackIds.map((id) => map[id]).filter((id): id is string => !!id);
          const same = drivePlaylists.find((p) => p.name === pl.name);
          if (same) {
            const missing = ids.filter((id) => !same.trackIds.includes(id));
            if (missing.length)
              await driveHome.addToPlaylist(same.id, missing).catch(() => undefined);
          } else if (ids.length || !pl.trackIds.length) {
            await driveHome.createPlaylist(pl.name, ids);
          }
        }
      }
    } finally {
      set({ running: false, finished: !stopRequested });
      await useLibrary.getState().load();
      await get().check();
    }
  },

  stop() {
    stopRequested = true;
  },
}));
