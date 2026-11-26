import { useRef, useState, type PointerEvent } from 'react';
import { SkipForward } from 'lucide-react';
import { useLocation } from 'wouter';
import { skipAvailability } from '../../hub/jamRemote';
import { useT } from '../../i18n';
import { swipeDecision, type SwipeDirection } from '../../lib/swipe';
import { useJam } from '../../stores/jam';
import { SongThumb } from '../SongThumb';
import '../../gestures.css';
import '../../jamRemote.css';

const MAX_DRAG_PX = 120;
const DRAG_START_PX = 12;
const HINT_FULL_PX = 72;

/** Finger swipe on a compact player: the content follows the finger where a swipe does something. */
export function useSwipe(
  onSwipe: (direction: SwipeDirection) => void,
  allows: (direction: SwipeDirection) => boolean,
) {
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
      const minLeft = allows('left') ? -MAX_DRAG_PX : 0;
      const maxRight = allows('right') ? MAX_DRAG_PX : 0;
      setDx(Math.max(minLeft, Math.min(mx, maxRight)));
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
      if (direction) onSwipe(direction);
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

export function SwipeHint({ dx }: { dx: number }) {
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

/** Takes the player's place for a guest whose phone is silent while the Jam plays. */
export function JamBar({ variant }: { variant: 'mini' | 'desktop' }) {
  const t = useT();
  const [, navigate] = useLocation();
  const snapshot = useJam((s) => s.snapshot);
  const locked = useJam((s) => s.skipLocked);
  const canSkip = !locked && skipAvailability(snapshot) === 'ok';
  const { dx, handlers, consumeSwipe } = useSwipe(
    (direction) => {
      if (direction !== 'left' || !canSkip) return;
      navigator.vibrate?.(15);
      useJam.getState().requestSkip();
    },
    (direction) => direction === 'left' && canSkip,
  );
  const song = snapshot?.nowPlaying?.song;
  if (!snapshot || !song) return null;

  return (
    <div
      className={`${variant === 'mini' ? 'mini-player' : 'player-bar'} jam-bar`}
      role="group"
      aria-label={t('jam.bar.label')}
    >
      <button
        className={`open-area jam-bar-open${dx ? ' dragging' : ''}`}
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onClick={() => {
          if (!consumeSwipe()) navigate('/jam');
        }}
        aria-label={t('jam.bar.open')}
        {...handlers}
      >
        <SongThumb videoId={song.videoId} size={46} />
        <div className="grow">
          <div className="track-title small ellipsis">{song.title}</div>
          <div className="muted small ellipsis">
            {t('jam.bar.playingOn', { name: snapshot.hostName })}
          </div>
        </div>
      </button>
      <button
        className="btn small primary jam-bar-skip"
        onClick={() => useJam.getState().requestSkip()}
        disabled={!canSkip}
        aria-label={t('jam.skip.label')}
      >
        <SkipForward size={16} /> {t('jam.next')}
      </button>
      {variant === 'mini' && <SwipeHint dx={dx} />}
    </div>
  );
}
