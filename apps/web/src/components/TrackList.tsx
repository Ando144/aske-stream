import { memo, useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  CircleCheck,
  Circle,
  EllipsisVertical,
  Heart,
  ListEnd,
  LoaderCircle,
} from 'lucide-react';
import { useT } from '../i18n';
import { formatDuration } from '../lib/format';
import type { LocalTrack as Track } from '../storage/types';
import { useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { useCurrentTrackId, usePlayer } from '../stores/player';
import { useUi } from '../stores/ui';
import { Cover } from './Cover';

interface ListProps {
  tracks: Track[];
  /** Called with the track that was tapped; the parent decides what the queue is. */
  onPlay: (trackId: string) => void;
  playlistId?: string;
}

export function TrackList({ tracks, onPlay, playlistId }: ListProps) {
  const currentId = useCurrentTrackId();
  const selection = useUi((s) => s.selection);
  const selected = new Set(selection ?? []);

  // "Select all" acts on whatever list is on screen.
  useEffect(() => {
    useUi.getState().setVisibleIds(tracks.map((tr) => tr.id));
  }, [tracks]);

  return (
    <div className="track-list" role="list">
      {tracks.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          current={track.id === currentId}
          onPlay={onPlay}
          playlistId={playlistId}
          selecting={selection !== null}
          selected={selected.has(track.id)}
        />
      ))}
    </div>
  );
}

interface RowProps {
  track: Track;
  current: boolean;
  onPlay: (trackId: string) => void;
  playlistId?: string;
  selecting: boolean;
  selected: boolean;
}

const SWIPE_TRIGGER = 72;
const LONG_PRESS_MS = 450;

const TrackRow = memo(function TrackRow({
  track,
  current,
  onPlay,
  playlistId,
  selecting,
  selected,
}: RowProps) {
  const t = useT();
  const offline = useOffline((s) =>
    track.locations.device
      ? 'device'
      : s.entries[track.id]
        ? 'saved'
        : s.downloading[track.id]
          ? 'downloading'
          : null,
  );
  const online = useUi((s) => s.online);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const openMenu = useUi((s) => s.openTrackMenu);
  const unavailable = !online && !offline;
  const liked = track.likedAt !== null;

  // Swipe right → add to queue. Long press → start selecting.
  const [dx, setDx] = useState(0);
  const gesture = useRef<{
    x: number;
    y: number;
    swiping: boolean;
    moved: boolean;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  const suppressClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const g = { x: e.clientX, y: e.clientY, swiping: false, moved: false } as NonNullable<
      typeof gesture.current
    >;
    if (!selecting) {
      g.timer = setTimeout(() => {
        if (!g.moved) {
          suppressClick.current = true;
          navigator.vibrate?.(20);
          useUi.getState().startSelection(track.id);
        }
      }, LONG_PRESS_MS);
    }
    gesture.current = g;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const mx = e.clientX - g.x;
    const my = e.clientY - g.y;
    if (Math.abs(mx) > 8 || Math.abs(my) > 8) {
      g.moved = true;
      clearTimeout(g.timer);
    }
    if (selecting) return;
    if (!g.swiping && mx > 12 && Math.abs(mx) > Math.abs(my) * 1.6) {
      g.swiping = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (g.swiping) setDx(Math.max(0, Math.min(mx, 120)));
  };

  const onPointerEnd = () => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    clearTimeout(g.timer);
    if (g.swiping) {
      suppressClick.current = true;
      if (dx >= SWIPE_TRIGGER) {
        navigator.vibrate?.(15);
        usePlayer.getState().addToQueue([track.id]);
      }
      setDx(0);
    }
  };

  const onMainClick = () => {
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    if (selecting) useUi.getState().toggleSelected(track.id);
    else onPlay(track.id);
  };

  return (
    <div
      className={`track${current ? ' current' : ''}${unavailable ? ' unavailable' : ''}${selected ? ' selected' : ''}`}
      role="listitem"
    >
      <div className="swipe-hint" style={{ opacity: Math.min(1, dx / SWIPE_TRIGGER) }} aria-hidden>
        <ListEnd size={18} /> {t('swipe.queue')}
      </div>
      <div
        className="track-inner"
        style={{ transform: dx ? `translateX(${dx}px)` : undefined }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onContextMenu={(e) => selecting && e.preventDefault()}
      >
        <button
          className="track-main"
          onClick={onMainClick}
          aria-label={selecting ? track.title : `${t('common.play')} ${track.title}`}
          aria-pressed={selecting ? selected : undefined}
        >
          {selecting && (
            <span className="select-mark" aria-hidden>
              {selected ? <CircleCheck size={22} /> : <Circle size={22} />}
            </span>
          )}
          <Cover trackId={track.id} hasCover={track.hasCover} />
          <div className="track-text">
            <div className="track-title">{track.title}</div>
            <div className="track-sub">
              {(offline === 'saved' || offline === 'device') && (
                <ArrowDownToLine size={14} className="badge-offline" aria-label="offline" />
              )}
              {offline === 'downloading' && (
                <LoaderCircle size={14} className="spin badge-offline" />
              )}
              <span>{track.artist || t('library.unknownArtist')}</span>
            </div>
          </div>
        </button>
        {!selecting && (
          <>
            <button
              className="icon-btn hover-only"
              onClick={() => usePlayer.getState().addToQueue([track.id])}
              aria-label={t('track.addToQueue')}
              title={t('track.addToQueue')}
            >
              <ListEnd size={18} />
            </button>
            <button
              className={`icon-btn${liked ? ' on' : ''}`}
              onClick={() => void toggleLike(track.id)}
              aria-label={liked ? t('track.unlike') : t('track.like')}
              aria-pressed={liked}
            >
              <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
            </button>
            <span className="track-duration">{formatDuration(track.durationMs)}</span>
            <button
              className="icon-btn"
              onClick={() => openMenu(track.id, playlistId)}
              aria-label={t('common.more')}
            >
              <EllipsisVertical size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
});
