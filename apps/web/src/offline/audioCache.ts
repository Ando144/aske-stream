import { mediaCredentials, mediaUrl } from '../api/client';

/**
 * Full audio files for offline playback live in Cache Storage (not
 * IndexedDB): large binary blobs are cheap there and survive app updates.
 * Playback of a cached song uses a blob: URL, so seeking works without the
 * service worker having to fake HTTP Range responses.
 */
const AUDIO_CACHE = 'aske-audio-v1';

/** Stable local key, independent of where the file came from or of any token. */
const cacheKey = (trackId: string) =>
  new Request(new URL(`/offline-audio/${trackId}`, location.origin));

async function open(): Promise<Cache> {
  return caches.open(AUDIO_CACHE);
}

export async function hasAudio(trackId: string): Promise<boolean> {
  return !!(await (await open()).match(cacheKey(trackId)));
}

export async function listCachedAudio(): Promise<Set<string>> {
  const keys = await (await open()).keys();
  return new Set(keys.map((req) => new URL(req.url).pathname.split('/').pop() ?? ''));
}

/** Downloads the whole file and stores it. Returns its size in bytes. */
export async function downloadAudio(
  trackId: string,
  remoteId: string,
  hasCover: boolean,
  signal?: AbortSignal,
): Promise<number> {
  const res = await fetch(mediaUrl('audio', remoteId), { credentials: mediaCredentials(), signal });
  if (res.status !== 200) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const headers = new Headers({
    'Content-Type': res.headers.get('Content-Type') ?? 'audio/ogg',
    'Content-Length': String(blob.size),
  });
  await (await open()).put(cacheKey(trackId), new Response(blob, { status: 200, headers }));
  // Warm the cover cache too (the service worker stores it cache-first).
  if (hasCover) {
    fetch(mediaUrl('cover', remoteId), { credentials: mediaCredentials() }).catch(() => undefined);
  }
  return blob.size;
}

/** Stores audio this device already has (e.g. a song it just downloaded from YouTube). */
export async function storeAudio(trackId: string, blob: Blob): Promise<number> {
  const headers = new Headers({
    'Content-Type': blob.type || 'audio/webm',
    'Content-Length': String(blob.size),
  });
  await (await open()).put(cacheKey(trackId), new Response(blob, { status: 200, headers }));
  return blob.size;
}

export async function deleteAudio(trackId: string): Promise<void> {
  await (await open()).delete(cacheKey(trackId));
}

export async function getAudioBlob(trackId: string): Promise<Blob | null> {
  const res = await (await open()).match(cacheKey(trackId));
  return res ? res.blob() : null;
}

export async function clearAllAudio(): Promise<void> {
  await caches.delete(AUDIO_CACHE);
}
