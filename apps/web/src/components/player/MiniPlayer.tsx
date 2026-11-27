import { Heart } from 'lucide-react';
import { useJamBarVisible } from '../../hub/jamRemote';
import { useT } from '../../i18n';
import { useLibrary } from '../../stores/library';
import { usePlayer } from '../../stores/player';
import { useUi } from '../../stores/ui';
import { SwipeTrack } from '../gestures/SwipeTrack';
import { useSwipe } from '../gestures/useSwipe';
import { JamBar } from '../jam/JamBar';
import { Artwork } from './Artwork';
import { PlayPauseButton, SeekBar, TransportControls, VolumeControl } from './Controls';
import { canChangeSong, changeSong, NeighbourCard } from './Neighbour';
import { usePlayingInfo } from './usePlayingInfo';

/** Compact player above the tab bar (phones). Tapping it opens the full screen player. */
export function MiniPlayer() {
  const t = useT();
  const info = usePlayingInfo();
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const open = useUi((s) => s.setNowPlayingOpen);
  const { dx, phase, width, handlers, consumeSwipe } = useSwipe({
    onSwipe: changeSong,
    allows: canChangeSong,
  });
  const showJamBar = useJamBarVisible();
  if (showJamBar) return <JamBar variant="mini" />;
  if (info.kind === 'none') return null;
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="mini-player" role="group" aria-label={t('player.swipeLabel')}>
      <button
        className="open-area"
        onClick={() => {
          if (!consumeSwipe()) open(true);
        }}
        aria-label={t('player.open')}
        {...handlers}
      >
        <SwipeTrack
          dx={dx}
          phase={phase}
          width={width}
          neighbour={(direction) => <NeighbourCard direction={direction} variant="mini" />}
        >
          <Artwork info={info} size={46} />
          <div className="grow">
            <div className="track-title small">{info.title}</div>
            <div className="muted small ellipsis">{info.subtitle}</div>
          </div>
        </SwipeTrack>
      </button>
      {info.kind === 'track' && <LikeButton trackId={info.trackId!} liked={info.liked} />}
      <PlayPauseButton className="icon-btn" size={24} />
      {info.kind === 'track' && (
        <div className="mini-progress">
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}

/** Desktop bottom bar. */
export function PlayerBar() {
  const t = useT();
  const info = usePlayingInfo();
  const open = useUi((s) => s.setNowPlayingOpen);
  const showJamBar = useJamBarVisible();
  if (showJamBar) return <JamBar variant="desktop" />;
  if (info.kind === 'none') return null;
  return (
    <div className="player-bar">
      <div className="now">
        <button onClick={() => open(true)} aria-label={t('player.open')}>
          <Artwork info={info} size={56} />
        </button>
        <div className="grow">
          <div className="track-title">{info.title}</div>
          <div className="muted small ellipsis">{info.subtitle}</div>
        </div>
        {info.kind === 'track' && <LikeButton trackId={info.trackId!} liked={info.liked} />}
      </div>
      <div className="center">
        <TransportControls />
        <SeekBar />
      </div>
      <div className="right">
        <VolumeControl />
      </div>
    </div>
  );
}

export function LikeButton({
  trackId,
  liked,
  size = 20,
}: {
  trackId: string;
  liked: boolean;
  size?: number;
}) {
  const t = useT();
  const toggleLike = useLibrary((s) => s.toggleLike);
  return (
    <button
      className={`icon-btn${liked ? ' on' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        void toggleLike(trackId);
      }}
      aria-label={liked ? t('track.unlike') : t('track.like')}
      aria-pressed={liked}
    >
      <Heart size={size} fill={liked ? 'currentColor' : 'none'} />
    </button>
  );
}
