import { isVideoId, sanitizeHubSong, type HubSong } from '@aske/shared/hub';
import type { LocalTrack } from '../storage/types';

/** Songs of a playlist that can travel in a link: YouTube ones, in order, without repeats. */
export function songsFromPlaylist(
  trackIds: string[],
  tracks: Record<string, LocalTrack>,
): { songs: HubSong[]; skipped: number } {
  const songs: HubSong[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for (const id of trackIds) {
    const track = tracks[id];
    if (!track) continue;
    const ref = track.sourceRef;
    if (track.source !== 'youtube' || !ref || !isVideoId(ref)) {
      skipped++;
      continue;
    }
    if (seen.has(ref)) continue;
    const song = sanitizeHubSong({
      videoId: ref,
      title: track.title,
      artist: track.artist,
      durationMs: track.durationMs,
    });
    if (!song) {
      skipped++;
      continue;
    }
    seen.add(ref);
    songs.push(song);
  }
  return { songs, skipped };
}

/** Which songs of a shared list are already in the library, and which are not. */
export function splitByLibrary(
  songs: HubSong[],
  tracks: Record<string, LocalTrack>,
): { have: string[]; missing: HubSong[] } {
  const byRef = new Map<string, string>();
  for (const track of Object.values(tracks)) {
    if (track.source === 'youtube' && track.sourceRef) byRef.set(track.sourceRef, track.id);
  }
  const have: string[] = [];
  const missing: HubSong[] = [];
  for (const song of songs) {
    const id = byRef.get(song.videoId);
    if (id) have.push(id);
    else missing.push(song);
  }
  return { have, missing };
}
