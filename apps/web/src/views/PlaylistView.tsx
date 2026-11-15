import { useMemo } from 'react';
import {
  ArrowDownToLine,
  ChevronLeft,
  CircleCheck,
  Heart,
  Pencil,
  Play,
  Shuffle,
  Trash2,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import type { Track } from '@aske/shared';
import { songCount, useT } from '../i18n';
import { formatLongDuration } from '../lib/format';
import { useAllTracks, useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { usePlayer } from '../stores/player';
import { confirmDialog, promptDialog } from '../stores/ui';
import { TrackList } from '../components/TrackList';
import { PlaylistArt } from './PlaylistsView';

export function PlaylistView({ id, liked = false }: { id?: string; liked?: boolean }) {
  const t = useT();
  const [, navigate] = useLocation();
  const allTracks = useAllTracks();
  const trackMap = useLibrary((s) => s.tracks);
  const playlist = useLibrary((s) => (id ? s.playlists.find((p) => p.id === id) : undefined));
  const entries = useOffline((s) => s.entries);

  const tracks: Track[] = useMemo(() => {
    if (liked) {
      return allTracks
        .filter((tr) => tr.likedAt !== null)
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
  const allDownloaded = ids.length > 0 && ids.every((tid) => entries[tid]?.mode === 'pinned');
  const context = { label: title, path: liked ? '/liked' : `/playlist/${id}` };
  const play = (startId: string | null, shuffle?: boolean) =>
    usePlayer.getState().playTracks(ids, startId, { shuffle, context });

  const rename = async () => {
    const name = await promptDialog({
      title: t('playlists.rename'),
      placeholder: t('playlists.namePlaceholder'),
      initial: playlist!.name,
      confirmLabel: t('common.save'),
    });
    if (name && name !== playlist!.name)
      await useLibrary.getState().renamePlaylist(playlist!.id, name);
  };

  const remove = async () => {
    const ok = await confirmDialog(
      t('playlists.deleteConfirm', { name: playlist!.name }),
      t('common.delete'),
      true,
    );
    if (!ok) return;
    navigate('/playlists');
    await useLibrary.getState().deletePlaylist(playlist!.id);
  };

  return (
    <div className="page">
      <Link href="/playlists" className="icon-btn" aria-label={t('common.back')}>
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
          onClick={() => void useOffline.getState().pin(ids)}
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
              className="icon-btn"
              onClick={() => void rename()}
              aria-label={t('playlists.rename')}
            >
              <Pencil size={20} />
            </button>
            <button
              className="icon-btn"
              onClick={() => void remove()}
              aria-label={t('playlists.delete')}
            >
              <Trash2 size={20} />
            </button>
          </>
        )}
      </div>

      {tracks.length === 0 ? (
        <p className="empty">{liked ? t('liked.empty') : t('playlists.emptyPlaylist')}</p>
      ) : (
        <TrackList
          tracks={tracks}
          onPlay={(tid) => play(tid)}
          playlistId={liked ? undefined : id}
        />
      )}
    </div>
  );
}
