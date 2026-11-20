import type { HubSong, JamItemView, JamSnapshot } from '@aske/shared/hub';

interface LibraryTrackRef {
  id: string;
  source?: string | null;
  sourceRef?: string | null;
}

/** videoId -> trackId for the YouTube songs that are already in the library. */
export function libraryByVideoId(tracks: Iterable<LibraryTrackRef>): Map<string, string> {
  const map = new Map<string, string>();
  for (const tr of tracks) {
    if (tr.source === 'youtube' && tr.sourceRef) map.set(tr.sourceRef, tr.id);
  }
  return map;
}

/** First song of the (already sorted) queue that is ready to play. */
export function nextReadyItem(
  snapshot: JamSnapshot,
  ready: Map<string, string>,
): JamItemView | null {
  return snapshot.queue.find((item) => ready.has(item.song.videoId)) ?? null;
}

/** Queued songs that are neither in the library nor being downloaded; one per videoId. */
export function songsToPrepare(
  snapshot: JamSnapshot,
  ready: Map<string, string>,
  inFlight: Set<string>,
): HubSong[] {
  const seen = new Set<string>();
  const songs: HubSong[] = [];
  for (const { song } of snapshot.queue) {
    const id = song.videoId;
    if (ready.has(id) || inFlight.has(id) || seen.has(id)) continue;
    seen.add(id);
    songs.push(song);
  }
  return songs;
}
