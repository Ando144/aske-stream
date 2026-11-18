import { LIMITS, type Station } from '@aske/shared';
import { apiFor, ApiError, type ApiTarget } from '../../api/client';
import { driveApi } from '../drive/api';
import { driveAudio, driveHome, driveQuota, type NewDriveTrack } from '../drive/home';
import { getDeviceFile, saveDeviceFile } from '../deviceFiles';
import { deviceHome, fromRemote, newLocalId } from '../homes';
import type { Destination, LibraryHome, LocalTrack, StationInput } from '../types';
import type { CopyEndpoint } from './run';

const stationInput = (s: Station): StationInput => ({
  rbUuid: s.rbUuid,
  name: s.name,
  streamUrl: s.streamUrl,
  homepage: s.homepage,
  favicon: s.favicon,
  countryCode: s.countryCode,
  tags: s.tags,
  codec: s.codec,
  bitrate: s.bitrate,
  hls: s.hls,
  liked: !!s.likedAt,
});

const newTrackMeta = (t: LocalTrack, hasCover: boolean): NewDriveTrack => ({
  title: t.title,
  artist: t.artist,
  album: t.album,
  durationMs: t.durationMs,
  sizeBytes: t.sizeBytes,
  bitrateKbps: t.bitrateKbps,
  hasCover,
  kind: t.kind,
  source: t.source,
  sourceRef: t.sourceRef,
  mime: t.mime,
});

/** Playlist and station operations are the same for the device and Drive homes. */
function homeParts(home: LibraryHome) {
  return {
    createPlaylist: (name: string, trackIds: string[]) => home.createPlaylist(name, trackIds),
    addToPlaylist: (id: string, trackIds: string[]) => home.addToPlaylist(id, trackIds),
    saveStation: (s: Station) => home.saveStation(stationInput(s)),
  };
}

async function storageFree(): Promise<number | null> {
  const est = await navigator.storage?.estimate?.();
  if (!est || est.quota === undefined || est.usage === undefined) return null;
  return est.quota - est.usage;
}

const deviceEndpoint: CopyEndpoint = {
  kind: 'device',
  async load() {
    const snap = await deviceHome.load();
    return {
      tracks: snap?.tracks ?? [],
      playlists: snap?.playlists ?? [],
      stations: await deviceHome.listStations(),
    };
  },
  async readAudio(t) {
    const file = await getDeviceFile('audio', t.id);
    if (!file) throw new Error('missing file');
    return file;
  },
  readCover: (t) => getDeviceFile('covers', t.id),
  async writeTrack(t, audio, cover) {
    const id = newLocalId();
    await saveDeviceFile('audio', id, audio);
    if (cover) await saveDeviceFile('covers', id, cover);
    const track: LocalTrack = {
      ...t,
      id,
      hasCover: !!cover,
      locations: { device: true },
    };
    await deviceHome.addTrack(track);
    return { track, existed: false };
  },
  ...homeParts(deviceHome),
  freeBytes: storageFree,
};

const driveEndpoint: CopyEndpoint = {
  kind: 'drive',
  async load() {
    const snap = await driveHome.load();
    return {
      tracks: snap?.tracks ?? [],
      playlists: snap?.playlists ?? [],
      stations: await driveHome.listStations(),
    };
  },
  async readAudio(t) {
    if (!t.locations.drive) throw new Error('missing file');
    return driveAudio(t.locations.drive);
  },
  async readCover(t) {
    return t.locations.driveCover ? driveApi.download(t.locations.driveCover) : null;
  },
  async writeTrack(t, audio, cover) {
    const track = await driveHome.addTrack(newTrackMeta(t, !!cover), audio, cover, {
      likedAt: t.likedAt,
      createdAt: t.createdAt,
    });
    return { track, existed: false };
  },
  ...homeParts(driveHome),
  async freeBytes() {
    const { limit, usage } = await driveQuota();
    return limit === null ? null : limit - usage;
  },
};

function uploadForm(t: LocalTrack, audio: Blob, cover: Blob | null): FormData {
  const form = new FormData();
  form.append(
    'meta',
    JSON.stringify({
      title: t.title.slice(0, LIMITS.titleMax),
      artist: t.artist.slice(0, LIMITS.titleMax),
      album: t.album.slice(0, LIMITS.titleMax),
      durationMs: t.durationMs,
      bitrateKbps: t.bitrateKbps,
      source: t.source ?? 'file',
      sourceRef: t.sourceRef,
      kind: t.kind,
    }),
  );
  form.append('audio', new File([audio], 'audio', { type: t.mime }));
  if (cover) form.append('cover', new File([cover], 'cover.jpg', { type: 'image/jpeg' }));
  return form;
}

function cloudflareEndpoint(conn: ApiTarget): CopyEndpoint {
  const api = apiFor(conn);
  const remoteId = (t: LocalTrack) => t.locations.cloudflare ?? t.id;

  async function existingId(t: LocalTrack): Promise<string | null> {
    if (!t.sourceRef) return null;
    const found = await api.ingestExists((t.source ?? 'file') as 'youtube' | 'file', t.sourceRef);
    return found.id;
  }

  return {
    kind: 'cloudflare',
    async load() {
      const res = await api.library();
      return {
        tracks: res?.library.tracks.map(fromRemote) ?? [],
        playlists: res?.library.playlists ?? [],
        stations: await api.stations(),
      };
    },
    readAudio: (t) => api.fetchMedia('audio', remoteId(t)),
    async readCover(t) {
      return t.hasCover ? api.fetchMedia('cover', remoteId(t)) : null;
    },
    async writeTrack(t, audio, cover) {
      let existed = false;
      let id: string;
      try {
        id = (await api.uploadTrack(uploadForm(t, audio, cover))).id;
      } catch (err) {
        const dup = err instanceof ApiError && err.status === 409 ? await existingId(t) : null;
        if (!dup) throw err;
        id = dup;
        existed = true;
      }
      const likedAt = t.likedAt;
      const track = fromRemote({ ...t, id, hasCover: !!cover });
      if (likedAt && !existed) await api.updateTrack(id, { liked: true });
      return { track: { ...track, likedAt: existed ? null : likedAt }, existed };
    },
    createPlaylist: (name, trackIds) => api.createPlaylist(name, trackIds),
    addToPlaylist: (id, trackIds) => api.addToPlaylist(id, trackIds),
    saveStation: (s) => api.saveStation(stationInput(s)),
    async freeBytes() {
      const stats = await api.storage();
      return stats.uploadLimitBytes - stats.usedBytes;
    },
  };
}

export function endpointFor(kind: Destination, cloudflare: ApiTarget | null): CopyEndpoint {
  if (kind === 'device') return deviceEndpoint;
  if (kind === 'drive') return driveEndpoint;
  if (!cloudflare) throw new Error('cloudflare_not_connected');
  return cloudflareEndpoint(cloudflare);
}
