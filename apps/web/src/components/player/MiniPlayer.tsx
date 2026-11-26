import { useRef, useState, type PointerEvent } from 'react';
import { Heart } from 'lucide-react';
import { jamSongPlaying } from '../../hub/jamFromLibrary';
import { useT } from '../../i18n';
import { swipeDecision, type SwipeDirection } from '../../lib/swipe';
import { useJam } from '../../stores/jam';
import { useLibrary } from '../../stores/library';
import { usePlayer } from '../../stores/player';
import { useUi } from '../../stores/ui';
import { Artwork } from './Artwork';
import { PlayPauseButton, SeekBar, TransportControls, VolumeControl } from './Controls';
import { usePlayingInfo } from './usePlayingInfo';
import '../../gestures.css';

const MAX_DRAG_PX = 120;
const DRAG_START_PX = 12;
const HINT_FULL_PX = 72;

/** In a Jam hosted here, the Jam decides what comes next and there is no going back. */
function changeSong(direction: SwipeDirection) {
  const inJam = jamSongPlaying();
  if (inJam && direction === 'right') return;
  navigator.vibrate?.(15);
  if (inJam) useJam.getState().skip();
  else if (direction === 'left') usePlayer.getState().next();
  else usePlayer.getState().previous({ skipRestart: true });
}

/** Finger swipe on the compact player: the content follows the finger. */
function useSongSwipe() {
  const [dx, setDx] = useState(0);
  const start = useRef<{ x: number; y: number; at: number; dragging: boolean } | null>(null);
  const swiped = useRef(false);

  const reset = () => {
    start.current = null;
    setDx(0);
  };

  const handlers = {
    onPointerDown(e: PointerEvent) {
      swiped.current = false;
      if (e.pointerType !== 'touch') return;
      start.current = { x: e.clientX, y: e.clientY, at: e.timeStamp, dragging: false };
    },
    onPointerMove(e: PointerEvent<HTMLElement>) {
      const s = start.current;
      if (!s) return;
      const mx = e.clientX - s.x;
      if (!s.dragging) {
        if (Math.abs(mx) <= DRAG_START_PX || Math.abs(mx) <= Math.abs(e.clientY - s.y)) return;
        s.dragging = true;
        e.currentTarget.setPointerCapture(e.pointerId);
      }
      const maxRight = jamSongPlaying() ? 0 : MAX_DRAG_PX;
      setDx(Math.max(-MAX_DRAG_PX, Math.min(mx, maxRight)));
    },
    onPointerUp(e: PointerEvent) {
      const s = start.current;
      reset();
      if (!s?.dragging) return;
      swiped.current = true;
      const direction = swipeDecision({
        dx: e.clientX - s.x,
        dy: e.clientY - s.y,
        ms: e.timeStamp - s.at,
        width: window.innerWidth,
        startX: s.x,
      });
      if (direction) changeSong(direction);
    },
    onPointerCancel: reset,
  };

  /** True once after a swipe, so that it does not also count as a tap. */
  const consumeSwipe = () => {
    const was = swiped.current;
    swiped.current = false;
    return was;
  };

  return { dx, handlers, consumeSwipe };
}

function SwipeHint({ dx }: { dx: number }) {
  const t = useT();
  if (dx === 0) return null;
  const next = dx < 0;
  return (
    <div
      className={`mini-swipe-hint ${next ? 'next' : 'prev'}`}
      style={{ opacity: Math.min(1, Math.abs(dx) / HINT_FULL_PX) }}
      aria-hidden
    >
      {next ? t('player.swipe.next') : t('player.swipe.prev')}
    </div>
  );
}

/** Compact player above the tab bar (phones). Tapping it opens the full screen player. */
export function MiniPlayer() {
  const t = useT();
  const info = usePlayingInfo();
  const position = usePlayer((s) => s.position);
  const duration = usePlayer((s) => s.duration);
  const open = useUi((s) => s.setNowPlayingOpen);
  const { dx, handlers, consumeSwipe } = useSongSwipe();
  if (info.kind === 'none') return null;
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;

  return (
    <div className="mini-player" role="group" aria-label={t('player.swipeLabel')}>
      <button
        className={`open-area${dx ? ' dragging' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onClick={() => {
          if (!consumeSwipe()) open(true);
        }}
        aria-label={t('player.open')}
        {...handlers}
      >
        <Artwork info={info} size={46} />
        <div className="grow">
          <div className="track-title small">{info.title}</div>
          <div className="muted small ellipsis">{info.subtitle}</div>
        </div>
      </button>
      {info.kind === 'track' && <LikeButton trackId={info.trackId!} liked={info.liked} />}
      <PlayPauseButton className="icon-btn" size={24} />
      <SwipeHint dx={dx} />
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
