import type { Playlist, Station, Track } from '@aske/shared';
import { api } from '../api/client';
import { getDb } from '../offline/db';
import { deleteDeviceFile } from './deviceFiles';
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

const fromRemote = (t: Track): LocalTrack => ({
  ...t,
  kind: t.kind ?? 'music',
  locations: { cloudflare: t.id },
  mime: 'audio/ogg',
});

export const cloudflareHome: LibraryHome = {
  kind: 'cloudflare',
  async load(etag) {
    const res = await api.library(etag);
    if (!res) return null;
    return {
      tracks: res.library.tracks.map(fromRemote),
      playlists: res.library.playlists,
      etag: res.etag,
    };
  },
  updateTrack: async (id, patch) => fromRemote(await api.updateTrack(id, patch)),
  deleteTrack: (id) => api.deleteTrack(id),
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
    const playlists = (await db.getAll('playlists')).sort((a, b) => a.createdAt - b.createdAt);
    return { tracks, playlists, etag: '' };
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
    const pl: Playlist = {
      id: newLocalId(),
      name,
      description: '',
      trackIds: [...new Set(trackIds)],
      createdAt: now,
      updatedAt: now,
    };
    await (await getDb()).put('playlists', pl);
    return pl;
  },

  async renamePlaylist(id, name) {
    return putPlaylist({ ...(await getPlaylist(id)), name });
  },

  async deletePlaylist(id) {
    await (await getDb()).delete('playlists', id);
  },

  async addToPlaylist(id, trackIds) {
    const pl = await getPlaylist(id);
    const fresh = trackIds.filter((t) => !pl.trackIds.includes(t));
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
