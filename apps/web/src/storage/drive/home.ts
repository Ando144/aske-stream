import {
  LIMITS,
  nextFolderPosition,
  reorderFolders,
  sortFolders,
  type Folder,
  type Playlist,
  type Station,
} from '@aske/shared';
import { kvGet, kvSet } from '../../offline/db';
import { newLocalId } from '../homes';
import type { LibraryHome, LocalTrack, StationInput, TrackPatch } from '../types';
import { driveApi, DriveError } from './api';
import {
  docFingerprint,
  emptyDoc,
  mergeDocs,
  parseDoc,
  toLocalTrack,
  type DocTrack,
  type LibraryDoc,
} from './doc';

/**
 * Google Drive home. In the user's Drive:
 *
 *   Aske Stream/
 *     library.json   ← songs, playlists, likes and stations
 *     audio/         ← one file per song ("Artist - Title.webm")
 *     covers/        ← the square covers
 *
 * A copy of library.json is kept on this device, so the library opens
 * instantly and changes made without internet are sent later. When two
 * devices change it, the most recent change of each item wins (see doc.ts).
 */

const ROOT = 'Aske Stream';
const LIBRARY_FILE = 'library.json';
const STATE_KEY = 'drive-state';
const PUSH_DELAY_MS = 3000;

interface DriveState {
  rootId: string | null;
  audioId: string | null;
  coversId: string | null;
  libraryFileId: string | null;
  /** Drive's revision number of library.json when we last read or wrote it. */
  remoteVersion: string | null;
  /** Local changes not yet in Drive. */
  dirty: boolean;
  doc: LibraryDoc;
}

const freshState = (): DriveState => ({
  rootId: null,
  audioId: null,
  coversId: null,
  libraryFileId: null,
  remoteVersion: null,
  dirty: false,
  doc: emptyDoc(),
});

let state: DriveState | null = null;
let loadingState: Promise<DriveState> | null = null;

/** Always the same object, even when several callers ask at once on start-up. */
function getState(): Promise<DriveState> {
  if (state) return Promise.resolve(state);
  loadingState ??= kvGet<DriveState>(STATE_KEY).then((saved) => {
    // A copy saved by an older version has no folders yet.
    state ??= saved ? { ...saved, doc: { ...emptyDoc(), ...saved.doc } } : freshState();
    return state;
  });
  return loadingState;
}

async function save() {
  if (state) await kvSet(STATE_KEY, state);
}

/** Forgets this device's copy (after disconnecting Google or switching accounts). */
export async function resetDriveState() {
  await getState();
  state = freshState();
  await save();
}

/** One Drive conversation at a time, in order. */
let chain: Promise<unknown> = Promise.resolve();
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function folder(name: string, parentId?: string): Promise<string> {
  return (await driveApi.findFolder(name, parentId)) ?? driveApi.createFolder(name, parentId);
}

async function ensureFolders(st: DriveState) {
  if (st.rootId && st.audioId && st.coversId) return;
  st.rootId = await folder(ROOT);
  st.audioId = await folder('audio', st.rootId);
  st.coversId = await folder('covers', st.rootId);
  st.libraryFileId = (await driveApi.findFile(LIBRARY_FILE, st.rootId))?.id ?? null;
  st.remoteVersion = null;
  await save();
}

async function readRemote(st: DriveState): Promise<LibraryDoc> {
  if (!st.libraryFileId) return emptyDoc();
  try {
    return parseDoc(await (await driveApi.download(st.libraryFileId)).text());
  } catch (err) {
    // Someone deleted the file (or the whole folder) in Drive: start again.
    if (err instanceof DriveError && err.status === 404) {
      Object.assign(st, { rootId: null, audioId: null, coversId: null, libraryFileId: null });
      await ensureFolders(st);
      return emptyDoc();
    }
    throw err;
  }
}

/**
 * Brings this device and Drive to the same library. Returns true when the
 * library on this device changed.
 */
function sync(force = false): Promise<boolean> {
  return serialized(async () => {
    const st = await getState();
    await ensureFolders(st);
    if (!force && !st.dirty && st.libraryFileId && st.remoteVersion) {
      const meta = await driveApi.get(st.libraryFileId).catch((err: unknown) => {
        if (err instanceof DriveError && err.status === 404) return null;
        throw err;
      });
      if (meta && meta.version === st.remoteVersion) return false;
    }
    const before = docFingerprint(st.doc);
    const sent = st.doc;
    const remote = await readRemote(st);
    const merged = mergeDocs(sent, remote);
    if (docFingerprint(merged) !== docFingerprint(remote) || !st.libraryFileId) {
      const blob = new Blob([JSON.stringify(merged)], { type: 'application/json' });
      const file = st.libraryFileId
        ? await driveApi.replace(st.libraryFileId, blob)
        : await driveApi.upload(
            { name: LIBRARY_FILE, mimeType: 'application/json', parentId: st.rootId! },
            blob,
          );
      st.libraryFileId = file.id;
      st.remoteVersion = file.version ?? null;
    } else {
      st.remoteVersion = st.libraryFileId
        ? ((await driveApi.get(st.libraryFileId)).version ?? null)
        : null;
    }
    // Changes made on this device while we were talking to Drive are kept.
    const changedMeanwhile = st.doc !== sent;
    st.doc = changedMeanwhile ? mergeDocs(st.doc, merged) : merged;
    st.dirty = changedMeanwhile;
    await save();
    if (changedMeanwhile) schedulePush();
    return docFingerprint(st.doc) !== before;
  });
}

let pushTimer: ReturnType<typeof setTimeout> | undefined;
function schedulePush(delay = PUSH_DELAY_MS) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    if (navigator.onLine)
      void sync().catch((err: unknown) => console.warn('Drive sync failed', err));
  }, delay);
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    if (state?.dirty) schedulePush(500);
  });
}

/** Sends pending changes now (e.g. before switching storage). */
export async function flushDrive(): Promise<void> {
  clearTimeout(pushTimer);
  if ((await getState()).dirty) await sync();
}

/** Applies a change on this device and sends it to Drive a moment later. */
async function change(fn: (doc: LibraryDoc, now: number) => void) {
  const st = await getState();
  const doc: LibraryDoc = {
    ...st.doc,
    tracks: { ...st.doc.tracks },
    playlists: { ...st.doc.playlists },
    folders: { ...st.doc.folders },
    stations: { ...st.doc.stations },
    deleted: { ...st.doc.deleted },
  };
  fn(doc, Date.now());
  st.doc = doc;
  st.dirty = true;
  await save();
  schedulePush();
}

function snapshot(doc: LibraryDoc) {
  return {
    tracks: Object.values(doc.tracks)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(toLocalTrack),
    playlists: Object.values(doc.playlists).sort((a, b) => a.createdAt - b.createdAt),
    folders: sortFolders(Object.values(doc.folders)),
    etag: docFingerprint(doc),
  };
}

function need<T>(value: T | undefined, what: string): T {
  if (!value) throw new Error(`${what} not found`);
  return value;
}

function stripStation({ updatedAt: _u, ...st }: Station & { updatedAt?: number }): Station {
  return st;
}

const safeName = (s: string) =>
  s
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);

const EXT: Record<string, string> = {
  'audio/webm': 'webm',
  'video/webm': 'webm',
  'audio/opus': 'opus',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/x-flac': 'flac',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/flac': 'flac',
  'audio/wav': 'wav',
};

export type NewDriveTrack = Omit<LocalTrack, 'id' | 'locations' | 'createdAt' | 'likedAt'>;

export const driveHome: LibraryHome & {
  addTrack: (
    meta: NewDriveTrack,
    audio: Blob,
    cover: Blob | null,
    keep?: { likedAt: number | null; createdAt: number },
  ) => Promise<LocalTrack>;
  findBySource: (source: string, ref: string) => Promise<LocalTrack | undefined>;
  /** Re-reads Drive now, even if nothing seems to have changed. */
  refresh: () => Promise<void>;
} = {
  kind: 'drive',

  async load(etag) {
    const st = await getState();
    if (navigator.onLine) {
      try {
        await sync();
      } catch (err) {
        // Without Drive the copy on this device still works.
        if (!st.libraryFileId && Object.keys(st.doc.tracks).length === 0) throw err;
      }
    }
    const snap = snapshot(st.doc);
    return etag && etag === snap.etag ? null : snap;
  },

  async refresh() {
    await sync(true);
  },

  async addTrack(meta, audio, cover, keep) {
    const st = await getState();
    await serialized(() => ensureFolders(st));
    const id = newLocalId();
    const ext = EXT[meta.mime] ?? 'audio';
    const base = safeName(meta.artist ? `${meta.artist} - ${meta.title}` : meta.title) || id;
    const audioFile = await driveApi.upload(
      { name: `${base}.${ext}`, mimeType: meta.mime, parentId: st.audioId! },
      audio,
    );
    let coverFileId: string | null = null;
    if (cover) {
      try {
        coverFileId = (
          await driveApi.upload(
            { name: `${id}.jpg`, mimeType: 'image/jpeg', parentId: st.coversId! },
            cover,
          )
        ).id;
      } catch {
        // A song without its cover is better than no song.
      }
    }
    const now = Date.now();
    const track: DocTrack = {
      ...meta,
      id,
      hasCover: !!coverFileId,
      likedAt: keep?.likedAt ?? null,
      createdAt: keep?.createdAt ?? now,
      audioFileId: audioFile.id,
      coverFileId,
      updatedAt: now,
    };
    await change((doc) => {
      doc.tracks[id] = track;
    });
    return toLocalTrack(track);
  },

  async findBySource(source, ref) {
    const { doc } = await getState();
    const found = Object.values(doc.tracks).find((t) => t.source === source && t.sourceRef === ref);
    return found ? toLocalTrack(found) : undefined;
  },

  async updateTrack(id, patch: TrackPatch) {
    let updated: DocTrack | undefined;
    await change((doc, now) => {
      const track = need(doc.tracks[id], 'Track');
      const { liked, ...fields } = patch;
      updated = {
        ...track,
        ...fields,
        likedAt: liked === undefined ? track.likedAt : liked ? (track.likedAt ?? now) : null,
        updatedAt: now,
      };
      doc.tracks[id] = updated;
    });
    return toLocalTrack(updated!);
  },

  async deleteTrack(id) {
    let files: (string | null)[] = [];
    await change((doc, now) => {
      const track = doc.tracks[id];
      if (track) files = [track.audioFileId, track.coverFileId];
      delete doc.tracks[id];
      doc.deleted[id] = now;
      for (const pl of Object.values(doc.playlists)) {
        if (pl.trackIds.includes(id)) {
          doc.playlists[pl.id] = {
            ...pl,
            trackIds: pl.trackIds.filter((t) => t !== id),
            updatedAt: now,
          };
        }
      }
    });
    // The files go to Drive's bin a moment later; nothing waits for it.
    void serialized(async () => {
      for (const f of files) if (f) await driveApi.remove(f).catch(() => undefined);
    });
  },

  async createPlaylist(name, trackIds) {
    const now = Date.now();
    const pl: Playlist = {
      id: newLocalId(),
      name,
      description: '',
      trackIds: [...new Set(trackIds)],
      createdAt: now,
      updatedAt: now,
    };
    await change((doc) => {
      doc.playlists[pl.id] = pl;
    });
    return pl;
  },

  async renamePlaylist(id, name) {
    return editPlaylist(id, (pl) => ({ ...pl, name }));
  },

  async deletePlaylist(id) {
    let coverFileId: string | null = null;
    await change((doc, now) => {
      coverFileId = doc.playlists[id]?.coverFileId ?? null;
      delete doc.playlists[id];
      doc.deleted[id] = now;
    });
    trashFile(coverFileId);
  },

  async createFolder(name) {
    const now = Date.now();
    const created: Folder = { id: newLocalId(), name, createdAt: now, updatedAt: now };
    await change((doc) => {
      created.position = nextFolderPosition(Object.values(doc.folders));
      doc.folders[created.id] = created;
    });
    return created;
  },

  async reorderFolders(ids) {
    let ordered: Folder[] = [];
    await change((doc, now) => {
      const result = reorderFolders(Object.values(doc.folders), ids, now);
      for (const folder of result.changed) doc.folders[folder.id] = folder;
      ordered = result.folders;
    });
    return ordered;
  },

  async renameFolder(id, name) {
    let renamed: Folder | undefined;
    await change((doc, now) => {
      renamed = { ...need(doc.folders[id], 'Folder'), name, updatedAt: now };
      doc.folders[id] = renamed;
    });
    return renamed!;
  },

  async deleteFolder(id) {
    await change((doc, now) => {
      delete doc.folders[id];
      doc.deleted[id] = now;
      for (const pl of Object.values(doc.playlists)) {
        if (pl.folderId === id) doc.playlists[pl.id] = { ...pl, folderId: null, updatedAt: now };
      }
    });
  },

  async movePlaylist(id, folderId) {
    const st = await getState();
    if (folderId !== null && !st.doc.folders[folderId]) throw new Error('folder_not_found');
    return editPlaylist(id, (pl) => ({ ...pl, folderId }));
  },

  async setPlaylistCover(id, jpeg) {
    const st = await getState();
    let uploaded: string | null = null;
    if (jpeg) {
      await serialized(() => ensureFolders(st));
      const file = await driveApi.upload(
        {
          name: `playlist-${id}-${Date.now()}.jpg`,
          mimeType: 'image/jpeg',
          parentId: st.coversId!,
        },
        jpeg,
      );
      uploaded = file.id;
    }
    let previous: string | null = null;
    try {
      const saved = await editPlaylist(id, (pl) => {
        previous = pl.coverFileId ?? null;
        return {
          ...pl,
          coverFileId: uploaded,
          coverAt: uploaded ? Date.now() : null,
        };
      });
      trashFile(previous);
      return saved;
    } catch (err) {
      // The playlist vanished meanwhile: do not leave an orphan file in Drive.
      trashFile(uploaded);
      throw err;
    }
  },

  async addToPlaylist(id, trackIds) {
    return editPlaylist(id, (pl) => {
      const fresh = [...new Set(trackIds.filter((t) => !pl.trackIds.includes(t)))];
      if (pl.trackIds.length + fresh.length > LIMITS.playlistMaxTracks) {
        throw new Error('playlist_full');
      }
      return { ...pl, trackIds: [...pl.trackIds, ...fresh] };
    });
  },

  async removeFromPlaylist(id, trackId) {
    return editPlaylist(id, (pl) => ({
      ...pl,
      trackIds: pl.trackIds.filter((t) => t !== trackId),
    }));
  },

  async reorderPlaylist(id, trackIds) {
    return editPlaylist(id, (pl) => {
      const same = new Set(pl.trackIds);
      if (trackIds.length !== same.size || !trackIds.every((t) => same.has(t))) {
        throw new Error('trackIds must contain the same tracks');
      }
      return { ...pl, trackIds };
    });
  },

  async listStations() {
    const { doc } = await getState();
    return Object.values(doc.stations)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map(stripStation);
  },

  async saveStation(input: StationInput) {
    if (!/^https?:\/\//.test(input.streamUrl)) throw new Error('Invalid stream URL');
    let saved: Station | undefined;
    await change((doc, now) => {
      const existing = input.rbUuid
        ? Object.values(doc.stations).find((s) => s.rbUuid === input.rbUuid)
        : undefined;
      const station = {
        id: existing?.id ?? newLocalId(),
        rbUuid: input.rbUuid ?? null,
        name: input.name,
        streamUrl: input.streamUrl,
        homepage: input.homepage ?? '',
        favicon: input.favicon ?? '',
        countryCode: (input.countryCode ?? '').toUpperCase(),
        tags: input.tags ?? [],
        codec: input.codec ?? '',
        bitrate: input.bitrate ?? 0,
        hls: input.hls ?? false,
        isCustom: !input.rbUuid,
        likedAt: input.liked === false ? null : (existing?.likedAt ?? now),
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };
      doc.stations[station.id] = station;
      saved = stripStation(station);
    });
    return saved!;
  },

  async updateStation(id, patch) {
    let saved: Station | undefined;
    await change((doc, now) => {
      const st = need(doc.stations[id], 'Station');
      const updated = {
        ...st,
        name: patch.name ?? st.name,
        likedAt: patch.liked === undefined ? st.likedAt : patch.liked ? (st.likedAt ?? now) : null,
        updatedAt: now,
      };
      doc.stations[id] = updated;
      saved = stripStation(updated);
    });
    return saved!;
  },

  async deleteStation(id) {
    await change((doc, now) => {
      delete doc.stations[id];
      doc.deleted[id] = now;
    });
  },
};

/** Sends a file to Drive's bin a moment later; nothing waits for it. */
function trashFile(fileId: string | null) {
  if (!fileId) return;
  void serialized(() => driveApi.remove(fileId).catch(() => undefined));
}

async function editPlaylist(id: string, fn: (pl: Playlist) => Playlist): Promise<Playlist> {
  let result: Playlist | undefined;
  await change((doc, now) => {
    const pl = need(doc.playlists[id], 'Playlist');
    result = { ...fn(pl), updatedAt: now };
    doc.playlists[id] = result;
  });
  return result!;
}

/** Downloads a song's audio from Drive (for playing it or keeping it offline). */
export function driveAudio(fileId: string, signal?: AbortSignal): Promise<Blob> {
  return driveApi.download(fileId, signal);
}

/** How full the user's Drive is. */
export const driveQuota = () => driveApi.quota();

// Browser tests (vite --mode fakenative) look inside.
if (import.meta.env.MODE === 'fakenative') {
  (window as unknown as Record<string, unknown>).__drive = { getState, sync, flushDrive };
}
