import { useMemo, useState } from 'react';
import {
  ArrowDownToLine,
  ChevronLeft,
  CircleCheck,
  Heart,
  ArrowUpDown,
  Ellipsis,
  Plus,
  Play,
  Share2,
  Shuffle,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import type { LocalTrack as Track } from '../storage/types';
import { songCount, useT } from '../i18n';
import { formatLongDuration } from '../lib/format';
import { useAllTracks, useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { usePlayer } from '../stores/player';
import { Cover } from '../components/Cover';
import { SortableList } from '../components/Sortable';
import { TrackList } from '../components/TrackList';
import { moveItem } from '../player/queue';
import { useUi } from '../stores/ui';
import { PlaylistArt } from '../components/PlaylistArt';
import { PlaylistMenu } from '../components/PlaylistMenu';
import { SharePlaylistSheet } from '../components/SharePlaylistSheet';

export function PlaylistView({ id, liked = false }: { id?: string; liked?: boolean }) {
  const [reordering, setReordering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const t = useT();
  const [, navigate] = useLocation();
  const allTracks = useAllTracks();
  const trackMap = useLibrary((s) => s.tracks);
  const playlist = useLibrary((s) => (id ? s.playlists.find((p) => p.id === id) : undefined));
  const entries = useOffline((s) => s.entries);

  const tracks: Track[] = useMemo(() => {
    if (liked) {
      return allTracks
        .filter((tr) => tr.likedAt !== null && tr.kind !== 'podcast')
        .sort((a, b) => (b.likedAt ?? 0) - (a.likedAt ?? 0));
    }
    return (playlist?.trackIds ?? []).map((tid) => trackMap[tid]).filter((tr): tr is Track => !!tr);
  }, [liked, allTracks, playlist, trackMap]);

  if (!liked && !playlist) {
    return (
      <div className="page">
        <p className="empty">{t('playlists.notFound')}</p>
      </div>
    );
  }

  const title = liked ? t('liked.title') : playlist!.name;
  const ids = tracks.map((tr) => tr.id);
  const totalMs = tracks.reduce((sum, tr) => sum + tr.durationMs, 0);
  const cloudIds = tracks.filter((tr) => !tr.locations.device).map((tr) => tr.id);
  const allDownloaded = ids.length > 0 && cloudIds.every((tid) => entries[tid]?.mode === 'pinned');
  const context = { label: title, path: liked ? '/liked' : `/playlist/${id}` };
  const play = (startId: string | null, shuffle?: boolean) =>
    usePlayer.getState().playTracks(ids, startId, { shuffle, context });

  return (
    <div className="page">
      <Link
        href={playlist?.folderId ? `/folder/${playlist.folderId}` : '/playlists'}
        className="icon-btn"
        aria-label={t('common.back')}
      >
        <ChevronLeft size={24} />
      </Link>
      <header className="collection-header">
        {liked ? (
          <div className="collection-art liked single">
            <Heart size={56} fill="currentColor" />
          </div>
        ) : (
          <PlaylistArt playlist={playlist!} tracks={trackMap} />
        )}
        <div className="grow">
          <div className="muted small">{t('nav.playlists')}</div>
          <h1>{title}</h1>
          <div className="muted small">
            {songCount(t, tracks.length)} · {formatLongDuration(totalMs)}
          </div>
        </div>
      </header>

      <div className="collection-actions">
        <button
          className="play-fab"
          onClick={() => play(null, false)}
          disabled={!ids.length}
          aria-label={t('common.play')}
        >
          <Play size={24} fill="currentColor" style={{ marginLeft: 2 }} />
        </button>
        <button
          className="icon-btn"
          onClick={() => play(null, true)}
          disabled={!ids.length}
          aria-label={t('common.shuffle')}
        >
          <Shuffle size={22} />
        </button>
        <button
          className={`icon-btn${allDownloaded ? ' on' : ''}`}
          onClick={() => void useOffline.getState().pin(cloudIds)}
          disabled={!ids.length || allDownloaded}
          aria-label={allDownloaded ? t('playlists.downloaded') : t('playlists.download')}
          title={allDownloaded ? t('playlists.downloaded') : t('playlists.download')}
        >
          {allDownloaded ? <CircleCheck size={22} /> : <ArrowDownToLine size={22} />}
        </button>
        {!liked && (
          <>
            <span className="grow" />
            <button
              className={`icon-btn${reordering ? ' on' : ''}`}
              onClick={() => setReordering(!reordering)}
              disabled={tracks.length < 2}
              aria-label={reordering ? t('playlists.reorderDone') : t('playlists.reorder')}
              title={reordering ? t('playlists.reorderDone') : t('playlists.reorder')}
            >
              <ArrowUpDown size={20} />
            </button>
            <button
              className="icon-btn"
              onClick={() => setShareOpen(true)}
              aria-label={t('share.button')}
              title={t('share.button')}
            >
              <Share2 size={20} />
            </button>
            <button
              className="icon-btn"
              onClick={() => setMenuOpen(true)}
              aria-label={t('playlists.menu')}
              title={t('playlists.menu')}
            >
              <Ellipsis size={20} />
            </button>
          </>
        )}
      </div>

      {!liked && (
        <div className="row wrap" style={{ marginBottom: 10 }}>
          <button className="btn small" onClick={() => navigate(`/?addTo=${id}`)}>
            <Plus size={16} /> {t('playlists.addSongs')}
          </button>
          {tracks.length > 0 && (
            <button className="btn small" onClick={() => useUi.getState().startSelection()}>
              <CircleCheck size={16} /> {t('select.start')}
            </button>
          )}
        </div>
      )}

      {reordering ? (
        <SortableList
          items={tracks}
          keyOf={(tr) => tr.id}
          handleLabel={t('queue.drag')}
          onMove={(from, to) =>
            void useLibrary.getState().reorderPlaylist(id!, moveItem(ids, from, to))
          }
          render={(tr, _i, handle) => (
            <div className="queue-item">
              {handle}
              <Cover trackId={tr.id} hasCover={tr.hasCover} size={40} />
              <div className="grow">
                <div className="track-title small">{tr.title}</div>
                <div className="muted small ellipsis">{tr.artist}</div>
              </div>
            </div>
          )}
        />
      ) : tracks.length === 0 ? (
        <p className="empty">{liked ? t('liked.empty') : t('playlists.emptyPlaylist')}</p>
      ) : (
        <TrackList
          tracks={tracks}
          onPlay={(tid) => play(tid)}
          playlistId={liked ? undefined : id}
        />
      )}
      {shareOpen && playlist && (
        <SharePlaylistSheet playlist={playlist} onClose={() => setShareOpen(false)} />
      )}
      {menuOpen && playlist && (
        <PlaylistMenu playlist={playlist} onClose={() => setMenuOpen(false)} />
      )}
    </div>
  );
}
