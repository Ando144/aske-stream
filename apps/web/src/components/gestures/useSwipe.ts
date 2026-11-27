import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from 'react';
import { flushSync } from 'react-dom';
import { swipeDecision, type SwipeDirection } from '../../lib/swipe';

const DRAG_START_PX = 12;
/** Must match the transition duration in swipe.css. */
const SETTLE_MS = 200;
/** Time the incoming content stays half way in before a keyboard swipe is confirmed. */
const KEY_PREVIEW_MS = 60;

export type SwipePhase = 'idle' | 'drag' | 'commit' | 'return';

interface SwipeOptions {
  onSwipe(direction: SwipeDirection): void;
  allows(direction: SwipeDirection): boolean;
  /** Longest drag in pixels; the width of the element by default. */
  maxDrag?: number;
}

interface DragStart {
  x: number;
  y: number;
  at: number;
  width: number;
  dragging: boolean;
}

const signOf = (direction: SwipeDirection) => (direction === 'left' ? -1 : 1);

/** One pending timeout at a time, immediate when the user asks for less motion. */
function useAnimationDelay() {
  const [reducedMotion] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const cancel = () => window.clearTimeout(timer.current);
  const later = (ms: number, run: () => void) => {
    cancel();
    timer.current = window.setTimeout(run, reducedMotion ? 0 : ms);
  };
  return { later, cancel };
}

/** Position of the swiped content and the timed animations that follow a release. */
function useSwipeMotion(options: RefObject<SwipeOptions>) {
  const [dx, setDx] = useState(0);
  const [phase, setPhase] = useState<SwipePhase>('idle');
  const [width, setWidth] = useState(0);
  const { later, cancel } = useAnimationDelay();
  /** True while a confirmed swipe is on its way: new gestures wait. */
  const committing = useRef(false);

  const move = (nextPhase: SwipePhase, nextDx: number) => {
    setPhase(nextPhase);
    setDx(nextDx);
  };

  const drag = (nextDx: number, nextWidth: number) => {
    cancel();
    setWidth(nextWidth);
    move('drag', nextDx);
  };

  const comeBack = () => {
    move('return', 0);
    later(SETTLE_MS, () => setPhase('idle'));
  };

  const commit = (direction: SwipeDirection, elementWidth: number) => {
    committing.current = true;
    setWidth(elementWidth);
    move('commit', signOf(direction) * elementWidth);
    later(SETTLE_MS, () => {
      committing.current = false;
      // One single paint: the new content must never show up still displaced.
      flushSync(() => {
        options.current.onSwipe(direction);
        move('idle', 0);
      });
    });
  };

  /** A keyboard swipe has no finger: show it half way first, so that it can be seen. */
  const preview = (direction: SwipeDirection, elementWidth: number) => {
    committing.current = true;
    drag((signOf(direction) * elementWidth) / 2, elementWidth);
    later(KEY_PREVIEW_MS, () => commit(direction, elementWidth));
  };

  return { dx, phase, width, committing, drag, comeBack, commit, preview };
}

type SwipeMotion = ReturnType<typeof useSwipeMotion>;

function usePointerSwipe(opts: SwipeOptions, motion: SwipeMotion) {
  const start = useRef<DragStart | null>(null);
  const swiped = useRef(false);

  const clamp = (distance: number, elementWidth: number) => {
    const limit = opts.maxDrag ?? elementWidth;
    const min = opts.allows('left') ? -limit : 0;
    const max = opts.allows('right') ? limit : 0;
    return Math.max(min, Math.min(distance, max));
  };

  const handlers = {
    onPointerDown(e: PointerEvent<HTMLElement>) {
      swiped.current = false;
      if (e.pointerType !== 'touch' || motion.committing.current) return;
      const elementWidth = e.currentTarget.offsetWidth;
      const point = { x: e.clientX, y: e.clientY, at: e.timeStamp };
      start.current = { ...point, width: elementWidth, dragging: false };
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
      motion.drag(clamp(mx, s.width), s.width);
    },
    onPointerUp(e: PointerEvent<HTMLElement>) {
      const s = start.current;
      start.current = null;
      if (!s?.dragging) return;
      swiped.current = true;
      const direction = swipeDecision({
        dx: e.clientX - s.x,
        dy: e.clientY - s.y,
        ms: e.timeStamp - s.at,
        width: window.innerWidth,
        startX: s.x,
      });
      if (direction && opts.allows(direction)) motion.commit(direction, s.width);
      else motion.comeBack();
    },
    onPointerCancel() {
      const wasDragging = start.current?.dragging;
      start.current = null;
      if (wasDragging) motion.comeBack();
    },
  };

  /** True once after a swipe, so that it does not also count as a tap. */
  const consumeSwipe = () => {
    const was = swiped.current;
    swiped.current = false;
    return was;
  };

  /** Forgets a finger gesture in progress. */
  const abandon = () => {
    start.current = null;
  };

  return { handlers, consumeSwipe, abandon };
}

/** Finger (or arrow key) swipe: the content follows where a swipe does something. */
export function useSwipe(opts: SwipeOptions) {
  const options = useRef(opts);
  useEffect(() => {
    options.current = opts;
  });
  const motion = useSwipeMotion(options);
  const pointer = usePointerSwipe(opts, motion);

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const direction = e.key === 'ArrowLeft' ? 'left' : 'right';
    if (motion.committing.current || !opts.allows(direction)) return;
    e.preventDefault();
    pointer.abandon();
    motion.preview(direction, e.currentTarget.offsetWidth);
  };

  return {
    dx: motion.dx,
    phase: motion.phase,
    width: motion.width,
    handlers: { ...pointer.handlers, onKeyDown },
    consumeSwipe: pointer.consumeSwipe,
  };
}
