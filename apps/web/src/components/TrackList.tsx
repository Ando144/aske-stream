import { memo } from 'react';
import { ArrowDownToLine, EllipsisVertical, Heart, LoaderCircle } from 'lucide-react';
import type { LocalTrack as Track } from '../storage/types';
import { useT } from '../i18n';
import { formatDuration } from '../lib/format';
import { useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { useCurrentTrackId } from '../stores/player';
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
  return (
    <div className="track-list" role="list">
      {tracks.map((track) => (
        <TrackRow
          key={track.id}
          track={track}
          current={track.id === currentId}
          onPlay={onPlay}
          playlistId={playlistId}
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
}

const TrackRow = memo(function TrackRow({ track, current, onPlay, playlistId }: RowProps) {
  const t = useT();
  const offline = useOffline((s) =>
    s.entries[track.id] ? 'saved' : s.downloading[track.id] ? 'downloading' : null,
  );
  const online = useUi((s) => s.online);
  const toggleLike = useLibrary((s) => s.toggleLike);
  const openMenu = useUi((s) => s.openTrackMenu);
  const unavailable = !online && offline !== 'saved';
  const liked = track.likedAt !== null;

  return (
    <div
      className={`track${current ? ' current' : ''}${unavailable ? ' unavailable' : ''}`}
      role="listitem"
    >
      <button
        className="track-main"
        onClick={() => onPlay(track.id)}
        aria-label={`${t('common.play')} ${track.title}`}
      >
        <Cover trackId={track.id} hasCover={track.hasCover} />
        <div className="track-text">
          <div className="track-title">{track.title}</div>
          <div className="track-sub">
            {offline === 'saved' && (
              <ArrowDownToLine size={14} className="badge-offline" aria-label="offline" />
            )}
            {offline === 'downloading' && <LoaderCircle size={14} className="spin badge-offline" />}
            <span>{track.artist || t('library.unknownArtist')}</span>
          </div>
        </div>
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
    </div>
  );
});
