import { useT } from '../../i18n';
import { useLibrary } from '../../stores/library';
import { useCurrentTrackId, usePlayer } from '../../stores/player';

export interface PlayingInfo {
  kind: 'track' | 'radio' | 'none';
  title: string;
  subtitle: string;
  trackId: string | null;
  hasCover: boolean;
  favicon: string;
  liked: boolean;
}

/** What the player is showing right now, for the mini player, bar and full screen. */
export function usePlayingInfo(): PlayingInfo {
  const t = useT();
  const mode = usePlayer((s) => s.mode);
  const station = usePlayer((s) => s.station);
  const trackId = useCurrentTrackId();
  const track = useLibrary((s) => (trackId ? s.tracks[trackId] : undefined));

  if (mode === 'radio' && station) {
    return {
      kind: 'radio',
      title: station.name,
      subtitle: station.subtitle || t('player.radio'),
      trackId: null,
      hasCover: false,
      favicon: station.favicon,
      liked: false,
    };
  }
  if (mode === 'track' && track) {
    return {
      kind: 'track',
      title: track.title,
      subtitle: track.artist || t('library.unknownArtist'),
      trackId: track.id,
      hasCover: track.hasCover,
      favicon: '',
      liked: track.likedAt !== null,
    };
  }
  return {
    kind: 'none',
    title: '',
    subtitle: '',
    trackId: null,
    hasCover: false,
    favicon: '',
    liked: false,
  };
}
