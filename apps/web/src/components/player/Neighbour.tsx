/** What a swipe on a player does, and what it shows coming in while the finger drags. */
import { jamSongPlaying } from '../../hub/jamFromLibrary';
import { useT } from '../../i18n';
import type { SwipeDirection } from '../../lib/swipe';
import { nextTrackId, previousTrackId } from '../../player/neighbours';
import { stationAt } from '../../player/radioEngine';
import { useJam } from '../../stores/jam';
import { useLibrary } from '../../stores/library';
import { usePlayer } from '../../stores/player';
import { SongThumb } from '../SongThumb';
import { Artwork } from './Artwork';
import type { PlayingInfo } from './usePlayingInfo';

const MINI_ART_PX = 46;

/** In a Jam hosted here, the Jam decides what comes next and there is no going back. */
export function canChangeSong(direction: SwipeDirection): boolean {
  return direction === 'left' || !jamSongPlaying();
}

export function changeSong(direction: SwipeDirection): void {
  if (!canChangeSong(direction)) return;
  navigator.vibrate?.(15);
  if (jamSongPlaying()) useJam.getState().skip();
  else if (direction === 'left') usePlayer.getState().next();
  else usePlayer.getState().previous({ skipRestart: true });
}

/** `videoId` marks a Jam song, which may not be in this library yet. */
type NeighbourSong = PlayingInfo & { videoId?: string };

const BLANK = { trackId: null, hasCover: false, favicon: '', liked: false };

/** The song or station a swipe in that direction would bring; null if there is none to show. */
export function useNeighbour(direction: SwipeDirection): NeighbourSong | null {
  const t = useT();
  const mode = usePlayer((s) => s.mode);
  const station = usePlayer((s) =>
    s.mode === 'radio'
      ? stationAt(s.stationList, s.station?.key, direction === 'left' ? 1 : -1)
      : null,
  );
  const trackId = usePlayer((s) => (direction === 'left' ? nextTrackId(s) : previousTrackId(s)));
  const track = useLibrary((s) => (trackId ? s.tracks[trackId] : undefined));
  const jamNext = useJam((s) => s.snapshot?.queue[0]?.song);

  if (jamSongPlaying()) {
    if (direction !== 'left' || !jamNext) return null;
    const subtitle = jamNext.artist || t('library.unknownArtist');
    const { title, videoId } = jamNext;
    return { ...BLANK, kind: 'track', title, subtitle, videoId };
  }
  if (station) {
    const { name, subtitle, favicon } = station;
    const fallback = t('player.radio');
    return { ...BLANK, kind: 'radio', title: name, subtitle: subtitle || fallback, favicon };
  }
  if (mode !== 'track' || !track) return null;
  return {
    ...BLANK,
    kind: 'track',
    title: track.title,
    subtitle: track.artist || t('library.unknownArtist'),
    trackId: track.id,
    hasCover: track.hasCover,
  };
}

function NeighbourArt({ song, size, className }: ArtProps) {
  if (!song.videoId) return <Artwork info={song} size={size} className={className} />;
  return (
    <SongThumb
      videoId={song.videoId}
      title={song.title}
      artist={song.subtitle}
      size={size}
      className={className}
    />
  );
}

interface ArtProps {
  song: NeighbourSong;
  size: number;
  className?: string;
}

/** Same layout as the current card of each player; SwipeTrack hides it from screen readers. */
export function NeighbourCard({
  direction,
  variant,
}: {
  direction: SwipeDirection;
  variant: 'mini' | 'big';
}) {
  const song = useNeighbour(direction);
  if (!song) return null;
  if (variant === 'mini') {
    return (
      <>
        <NeighbourArt song={song} size={MINI_ART_PX} />
        <div className="grow">
          <div className="track-title small">{song.title}</div>
          <div className="muted small ellipsis">{song.subtitle}</div>
        </div>
      </>
    );
  }
  return (
    <>
      <NeighbourArt
        song={song}
        size={0}
        className={`np-art${song.kind === 'radio' ? ' radio' : ''}`}
      />
      <div className="row">
        <div className="grow">
          <div className="np-title ellipsis">{song.title}</div>
          <div className="muted ellipsis">{song.subtitle}</div>
        </div>
      </div>
    </>
  );
}
