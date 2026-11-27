import { useRef, type ReactNode } from 'react';
import { neighbourOffset, swipeProgress, type SwipeDirection } from '../../lib/swipe';
import type { SwipePhase } from './useSwipe';
import '../../swipe.css';

const FADE_SHARE = 0.5;

interface SwipeTrackProps {
  dx: number;
  phase: SwipePhase;
  width: number;
  neighbour: (direction: SwipeDirection) => ReactNode | null;
  children: ReactNode;
}

/** Carousel: the incoming content slides in glued to the one the finger drags away. */
export function SwipeTrack({ dx, phase, width, neighbour, children }: SwipeTrackProps) {
  // Remembered so that the neighbour can also slide back out when the swipe is given up.
  const lastDirection = useRef<SwipeDirection>('left');
  if (dx !== 0) lastDirection.current = dx < 0 ? 'left' : 'right';
  const direction = lastDirection.current;
  const visible = width > 0 && (dx !== 0 || phase === 'return');
  const incoming = visible ? neighbour(direction) : null;
  const restOffset = direction === 'left' ? width : -width;
  const offset = dx === 0 ? restOffset : neighbourOffset(dx, width);
  const dragged = {
    transform: `translateX(${dx}px)`,
    opacity: 1 - swipeProgress(dx, width) * FADE_SHARE,
  };

  return (
    <div className={`swipe-track ${phase}`}>
      <div className="swipe-current" style={dx === 0 ? undefined : dragged}>
        {children}
      </div>
      {incoming !== null && (
        <div
          className="swipe-neighbour"
          style={{ transform: `translateX(${offset}px)` }}
          aria-hidden
        >
          {incoming}
        </div>
      )}
    </div>
  );
}
