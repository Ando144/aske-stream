/** Sending songs of the user's own library to the Jam they are in. */
import { HUB_LIMITS, sanitizeHubSong, type HubSong } from '@aske/shared/hub';
import { t } from '../i18n';
import { normalizeText } from '../lib/format';
import type { LocalTrack } from '../storage/types';
import { useJam } from '../stores/jam';
import { useLibrary } from '../stores/library';
import { usePlayer } from '../stores/player';
import { toast } from '../stores/ui';

/** null when the track cannot play in a Jam (it does not come from YouTube). */
export function toHubSong(track: LocalTrack): HubSong | null {
  if (track.source !== 'youtube') return null;
  return sanitizeHubSong({
    videoId: track.sourceRef,
    title: track.title,
    artist: track.artist,
    durationMs: track.durationMs || undefined,
  });
}

export interface JamSendPlan {
  songs: HubSong[];
  notYoutube: number;
  overLimit: number;
}

export function planJamSend(tracks: LocalTrack[], room: number): JamSendPlan {
  const sendable = tracks.map(toHubSong).filter((song) => song !== null);
  const songs = sendable.slice(0, Math.max(0, room));
  return {
    songs,
    notYoutube: tracks.length - sendable.length,
    overLimit: sendable.length - songs.length,
  };
}

/** How many more songs of mine the Jam accepts right now. */
export function jamRoom(): number {
  const waiting = useJam.getState().snapshot?.queue.filter((item) => item.mine).length ?? 0;
  return Math.max(0, HUB_LIMITS.jamMaxPendingPerMember - waiting);
}

export function jamIsActive(): boolean {
  const { session, connection } = useJam.getState();
  return session !== null && connection === 'open';
}

/** True when this phone hosts the Jam and its player is on the Jam's current song. */
export function jamSongPlaying(): boolean {
  const { session, snapshot } = useJam.getState();
  const nowPlaying = snapshot?.nowPlaying;
  if (session?.role !== 'host' || !nowPlaying) return false;
  const { mode, currentId } = usePlayer.getState();
  if (mode !== 'track' || !currentId) return false;
  const track = useLibrary.getState().tracks[currentId];
  return track?.sourceRef === nowPlaying.song.videoId;
}

function notifyPlan({ songs, notYoutube, overLimit }: JamSendPlan): void {
  if (songs.length > 0) toast(t('jamSend.done', { count: songs.length }));
  if (notYoutube > 0) toast(t('jamSend.notYoutube', { count: notYoutube }), 'error');
  if (overLimit > 0) {
    const max = HUB_LIMITS.jamMaxPendingPerMember;
    toast(t('jamSend.limit', { count: overLimit, max }), 'error');
  }
}

export function addTracksToJam(trackIds: string[]): void {
  if (!jamIsActive()) {
    toast(t('jamSend.offline'), 'error');
    return;
  }
  const library = useLibrary.getState().tracks;
  const tracks = trackIds.map((id) => library[id]).filter((track) => track !== undefined);
  const plan = planJamSend(tracks, jamRoom());
  const { add } = useJam.getState();
  plan.songs.forEach((song) => add(song));
  notifyPlan(plan);
}

/** YouTube songs of the library matching the search, newest first. */
export function filterLibrarySongs(tracks: LocalTrack[], query: string, max: number): LocalTrack[] {
  const needle = normalizeText(query.trim());
  return tracks
    .filter(
      (track) =>
        toHubSong(track) !== null &&
        normalizeText(`${track.title}\n${track.artist}\n${track.album}`).includes(needle),
    )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, max);
}
