import { mediaCredentials, mediaUrl } from '../api/client';
import { getAudioBlob } from '../offline/audioCache';
import { getDeviceFile } from './deviceFiles';
import { driveAudio } from './drive/home';
import { driveApi } from './drive/api';
import type { LocalTrack } from './types';

/**
 * Picks where to play a song from, in order of preference:
 *   1. a file stored on this device (no network at all),
 *   2. the smart offline cache,
 *   3. Cloudflare (streamed with Range requests), or Google Drive (the
 *      whole song is fetched first: Drive only hands files out with the
 *      user's token in a header, which an <audio> element cannot send).
 * Returns a URL for the <audio> element, or null if nothing is reachable.
 */
export async function resolveAudio(
  track: LocalTrack,
  inOfflineCache: boolean,
): Promise<string | null> {
  if (track.locations.device) {
    const file = await getDeviceFile('audio', track.id);
    if (file) return URL.createObjectURL(file);
  }
  if (inOfflineCache) {
    const blob = await getAudioBlob(track.id);
    if (blob) return URL.createObjectURL(blob);
  }
  if (track.locations.cloudflare && navigator.onLine) {
    return mediaUrl('audio', track.locations.cloudflare);
  }
  if (track.locations.drive && navigator.onLine) {
    try {
      return URL.createObjectURL(await driveAudio(track.locations.drive));
    } catch {
      return null;
    }
  }
  return null;
}

/** Device covers are read once and kept as object URLs for the session. */
const deviceCoverUrls = new Map<string, Promise<string | null>>();

export function resolveCoverUrl(track: LocalTrack): Promise<string | null> | string | null {
  if (!track.hasCover) return null;
  if (track.locations.device) {
    let url = deviceCoverUrls.get(track.id);
    if (!url) {
      url = getDeviceFile('covers', track.id).then((f) => (f ? URL.createObjectURL(f) : null));
      deviceCoverUrls.set(track.id, url);
    }
    return url;
  }
  if (track.locations.cloudflare) return mediaUrl('cover', track.locations.cloudflare);
  const driveCover = track.locations.driveCover;
  if (driveCover) {
    let url = driveCoverUrls.get(driveCover);
    if (!url) {
      url = loadDriveCover(driveCover);
      driveCoverUrls.set(driveCover, url);
    }
    return url;
  }
  return null;
}

/** Drive covers: kept on this device after the first time (they are tiny). */
const driveCoverUrls = new Map<string, Promise<string | null>>();
const COVER_CACHE = 'aske-drive-covers-v1';

async function driveCoverBlob(fileId: string): Promise<Blob | null> {
  const key = new Request(new URL(`/drive-cover/${fileId}`, location.origin));
  try {
    const cache = await caches.open(COVER_CACHE);
    const hit = await cache.match(key);
    if (hit) return await hit.blob();
    if (!navigator.onLine) return null;
    const blob = await driveApi.download(fileId);
    await cache.put(key, new Response(blob, { headers: { 'Content-Type': 'image/jpeg' } }));
    return blob;
  } catch {
    return null;
  }
}

async function loadDriveCover(fileId: string): Promise<string | null> {
  const blob = await driveCoverBlob(fileId);
  if (!blob) driveCoverUrls.delete(fileId); // try again next time
  return blob ? URL.createObjectURL(blob) : null;
}

/** Lock-screen artwork must be self-contained, so it is handed over as a data: URL. */
export async function resolveCoverDataUrl(track: LocalTrack): Promise<string | null> {
  try {
    let blob: Blob | null = null;
    if (track.locations.device) blob = await getDeviceFile('covers', track.id);
    else if (track.locations.driveCover) blob = await driveCoverBlob(track.locations.driveCover);
    else if (track.locations.cloudflare) {
      const res = await fetch(mediaUrl('cover', track.locations.cloudflare), {
        credentials: mediaCredentials(),
      });
      if (res.ok) blob = await res.blob();
    }
    if (!blob) return null;
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
