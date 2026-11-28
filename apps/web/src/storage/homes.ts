import {
  LIMITS,
  nextFolderPosition,
  nextPlaylistPosition,
  reorderFolders,
  reorderPlaylists,
  sortFolders,
  sortPlaylists,
} from '@aske/shared';
import type { Folder, Playlist, Station, Track } from '@aske/shared';
import { ApiError, api } from '../api/client';
import { getDb } from '../offline/db';
import { deleteDeviceFile, saveDeviceFile } from './deviceFiles';
import type { LibraryHome, LocalTrack, StationInput, TrackPatch } from './types';

export function newLocalId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(
    bytes,
    (b) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'[b % 62],
  ).join('');
}

/* ------------------------------------------------------------------ */
/* Cloudflare home: the v1 Worker (D1 + R2)                            */
/* ------------------------------------------------------------------ */

export const fromRemote = (t: Track): LocalTrack => ({
  ...t,
  kind: t.kind ?? 'music',
  locations: { cloudflare: t.id },
  mime: 'audio/ogg',
});

/** A Worker without the 0004 migration answers 404 "Unknown endpoint" to folder/cover calls. */
async function orOutdated<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (err) {
    if (err instanceof ApiError && err.status === 404 && err.code === 'not_found') {
      if (err.message === 'Unknown endpoint') throw new Error('cloudflare_outdated');
    }
    throw err;
  }
}

/** An old Worker rejects the unknown `pinned` field with 400 validation_error, not 404. */
async function orOutdatedPin<T>(call: Promise<T>): Promise<T> {
  try {
    return await orOutdated(call);
  } catch (err) {
    if (err instanceof ApiError && err.status === 400 && err.code === 'validation_error') {
      throw new Error('cloudflare_outdated');
    }
    throw err;
  }
}

/** Every Worker has this route, so a 404 means the song was already gone. */
async function deleteOnCloudflare(id: string): Promise<void> {
  try {
    await api.deleteTrack(id);
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 404)) throw err;
  }
}

async function moveOnCloudflare(id: string, folderId: string | null): Promise<Playlist> {
  try {
    return await orOutdated(api.updatePlaylist(id, { folderId }));
  } catch (err) {
    if (err instanceof ApiError && err.code === 'folder_not_found') {
      throw new Error('folder_not_found');
    }
    throw err;
  }
}

export const cloudflareHome: LibraryHome = {
  kind: 'cloudflare',
  async load(etag) {
    const res = await api.library(etag);
    if (!res) return null;
    return {
      tracks: res.library.tracks.map(fromRemote),
      playlists: sortPlaylists(res.library.playlists),
      folders: sortFolders(res.library.folders ?? []),
      etag: res.etag,
    };
  },
  createFolder: (name) => orOutdated(api.createFolder(name)),
  renameFolder: (id, name) => orOutdated(api.updateFolder(id, { name })),
  deleteFolder: (id) => orOutdated(api.deleteFolder(id)),
  reorderFolders: (ids) => orOutdated(api.reorderFolders(ids)),
  movePlaylist: moveOnCloudflare,
  setPlaylistPinned: (id, pinned) => orOutdatedPin(api.updatePlaylist(id, { pinned })),
  setFolderPinned: (id, pinned) => orOutdatedPin(api.updateFolder(id, { pinned })),
  orderPlaylists: async (folderId, ids) =>
    (await orOutdated(api.orderPlaylists(folderId, ids))).playlists,
  setPlaylistCover: (id, jpeg) =>
    orOutdated(jpeg ? api.setPlaylistCover(id, jpeg) : api.removePlaylistCover(id)),
  updateTrack: async (id, patch) => fromRemote(await api.updateTrack(id, patch)),
  deleteTrack: deleteOnCloudflare,
  createPlaylist: (name, ids) => api.createPlaylist(name, ids),
  renamePlaylist: (id, name) => api.updatePlaylist(id, { name }),
  deletePlaylist: (id) => api.deletePlaylist(id),
  addToPlaylist: (id, ids) => api.addToPlaylist(id, ids),
  removeFromPlaylist: (id, trackId) => api.removeFromPlaylist(id, trackId),
  reorderPlaylist: (id, trackIds) => api.reorderPlaylist(id, trackIds),
  listStations: () => api.stations(),
  saveStation: (s) => api.saveStation(s),
  updateStation: (id, patch) => api.updateStation(id, patch),
  deleteStation: (id) => api.deleteStation(id),
};

/* ------------------------------------------------------------------ */
/* Device home: everything in IndexedDB on this phone/computer          */
/* ------------------------------------------------------------------ */

function notFound(what: string): never {
  throw new Error(`${what} not found`);
}

async function getPlaylist(id: string): Promise<Playlist> {
  return (await (await getDb()).get('playlists', id)) ?? notFound('Playlist');
}

async function putPlaylist(pl: Playlist): Promise<Playlist> {
  const updated = { ...pl, updatedAt: Date.now() };
  await (await getDb()).put('playlists', updated);
  return updated;
}

export const deviceHome: LibraryHome & {
  addTrack: (track: LocalTrack) => Promise<LocalTrack>;
  findBySource: (source: string, ref: string) => Promise<LocalTrack | undefined>;
} = {
  kind: 'device',

  async load() {
    const db = await getDb();
    const tracks = (await db.getAll('tracks')).sort((a, b) => b.createdAt - a.createdAt);
    const playlists = sortPlaylists(await db.getAll('playlists'));
    const folders = sortFolders(await db.getAll('folders'));
    return { tracks, playlists, folders, etag: '' };
  },

  async createFolder(name) {
    const now = Date.now();
    const db = await getDb();
    const position = nextFolderPosition(await db.getAll('folders'));
    const folder: Folder = { id: newLocalId(), name, createdAt: now, updatedAt: now, position };
    await db.put('folders', folder);
    return folder;
  },

  async reorderFolders(ids) {
    const db = await getDb();
    const tx = db.transaction('folders', 'readwrite');
    const result = reorderFolders(await tx.store.getAll(), ids, Date.now());
    for (const folder of result.changed) await tx.store.put(folder);
    await tx.done;
    return result.folders;
  },

  async renameFolder(id, name) {
    const db = await getDb();
    const folder = (await db.get('folders', id)) ?? notFound('Folder');
    const updated = { ...folder, name, updatedAt: Date.now() };
    await db.put('folders', updated);
    return updated;
  },

  async deleteFolder(id) {
    const db = await getDb();
    for (const pl of await db.getAll('playlists')) {
      if (pl.folderId === id) await putPlaylist({ ...pl, folderId: null });
    }
    await db.delete('folders', id);
  },

  async movePlaylist(id, folderId) {
    const pl = await getPlaylist(id);
    if (folderId !== null && !(await (await getDb()).get('folders', folderId))) {
      throw new Error('folder_not_found');
    }
    const position = nextPlaylistPosition(await (await getDb()).getAll('playlists'), folderId);
    return putPlaylist({ ...pl, folderId, position });
  },

  async setPlaylistPinned(id, pinned) {
    const pl = await getPlaylist(id);
    return putPlaylist({ ...pl, pinnedAt: pinned ? Date.now() : null });
  },

  async setFolderPinned(id, pinned) {
    const db = await getDb();
    const folder = (await db.get('folders', id)) ?? notFound('Folder');
    const updated = { ...folder, pinnedAt: pinned ? Date.now() : null, updatedAt: Date.now() };
    await db.put('folders', updated);
    return updated;
  },

  async orderPlaylists(folderId, ids) {
    const db = await getDb();
    const tx = db.transaction('playlists', 'readwrite');
    const result = reorderPlaylists(await tx.store.getAll(), folderId, ids, Date.now());
    for (const pl of result.changed) await tx.store.put(pl);
    await tx.done;
    return result.playlists;
  },

  async setPlaylistCover(id, jpeg) {
    const pl = await getPlaylist(id);
    if (jpeg) await saveDeviceFile('playlist-covers', id, jpeg);
    else await deleteDeviceFile('playlist-covers', id);
    return putPlaylist({ ...pl, coverAt: jpeg ? Date.now() : null });
  },

  async addTrack(track) {
    await (await getDb()).put('tracks', track);
    return track;
  },

  async findBySource(source, ref) {
    const all = await (await getDb()).getAll('tracks');
    return all.find((t) => t.source === source && t.sourceRef === ref);
  },

  async updateTrack(id, patch) {
    const db = await getDb();
    const track = (await db.get('tracks', id)) ?? notFound('Track');
    const { liked, ...fields } = patch;
    const updated: LocalTrack = {
      ...track,
      ...fields,
      likedAt: liked === undefined ? track.likedAt : liked ? (track.likedAt ?? Date.now()) : null,
    };
    await db.put('tracks', updated);
    return updated;
  },

  async deleteTrack(id) {
    const db = await getDb();
    await db.delete('tracks', id);
    for (const pl of await db.getAll('playlists')) {
      if (pl.trackIds.includes(id)) {
        await db.put('playlists', { ...pl, trackIds: pl.trackIds.filter((t) => t !== id) });
      }
    }
    await deleteDeviceFile('audio', id);
    await deleteDeviceFile('covers', id);
  },

  async createPlaylist(name, trackIds) {
    const now = Date.now();
    const db = await getDb();
    const pl: Playlist = {
      id: newLocalId(),
      name,
      description: '',
      trackIds: [...new Set(trackIds)],
      createdAt: now,
      updatedAt: now,
      position: nextPlaylistPosition(await db.getAll('playlists'), null),
    };
    await db.put('playlists', pl);
    return pl;
  },

  async renamePlaylist(id, name) {
    return putPlaylist({ ...(await getPlaylist(id)), name });
  },

  async deletePlaylist(id) {
    await (await getDb()).delete('playlists', id);
    await deleteDeviceFile('playlist-covers', id);
  },

  async addToPlaylist(id, trackIds) {
    const pl = await getPlaylist(id);
    const fresh = trackIds.filter((t) => !pl.trackIds.includes(t));
    if (pl.trackIds.length + new Set(fresh).size > LIMITS.playlistMaxTracks) {
      throw new Error('playlist_full');
    }
    return putPlaylist({ ...pl, trackIds: [...pl.trackIds, ...new Set(fresh)] });
  },

  async removeFromPlaylist(id, trackId) {
    const pl = await getPlaylist(id);
    return putPlaylist({ ...pl, trackIds: pl.trackIds.filter((t) => t !== trackId) });
  },

  async reorderPlaylist(id, trackIds) {
    const pl = await getPlaylist(id);
    const same = new Set(pl.trackIds);
    if (trackIds.length !== same.size || !trackIds.every((t) => same.has(t))) {
      throw new Error('trackIds must contain the same tracks');
    }
    return putPlaylist({ ...pl, trackIds });
  },

  async listStations() {
    return (await getDb()).getAll('stations');
  },

  async saveStation(input: StationInput) {
    const db = await getDb();
    const existing = input.rbUuid
      ? (await db.getAll('stations')).find((s) => s.rbUuid === input.rbUuid)
      : undefined;
    const now = Date.now();
    const station: Station = {
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
    };
    if (!/^https?:\/\//.test(station.streamUrl)) throw new Error('Invalid stream URL');
    await db.put('stations', station);
    return station;
  },

  async updateStation(id, patch) {
    const db = await getDb();
    const st = (await db.get('stations', id)) ?? notFound('Station');
    const updated: Station = {
      ...st,
      name: patch.name ?? st.name,
      likedAt:
        patch.liked === undefined ? st.likedAt : patch.liked ? (st.likedAt ?? Date.now()) : null,
    };
    await db.put('stations', updated);
    return updated;
  },

  async deleteStation(id) {
    await (await getDb()).delete('stations', id);
  },
};
