import {
  ArrowDownToLine,
  CircleMinus,
  Heart,
  ListEnd,
  ListPlus,
  ListStart,
  ListX,
  Smartphone,
  CircleCheck,
  Mic,
  Music,
  Trash2,
} from 'lucide-react';
import { useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { usePodcasts } from '../stores/podcasts';
import { usePlayer } from '../stores/player';
import { confirmDialog, useUi } from '../stores/ui';
import { Cover } from './Cover';
import { Sheet } from './Sheet';

/** The ⋮ menu of a song. One instance, driven by the UI store. */
export function TrackMenu() {
  const menu = useUi((s) => s.trackMenu);
  const close = useUi((s) => s.closeTrackMenu);
  const track = useLibrary((s) => (menu ? s.tracks[menu.trackId] : undefined));
  const playlist = useLibrary((s) =>
    menu?.playlistId ? s.playlists.find((p) => p.id === menu.playlistId) : undefined,
  );
  const offlineMode = useOffline((s) => (menu ? s.entries[menu.trackId]?.mode : undefined));
  const t = useT();
  const finished = usePodcasts((s) => (menu ? !!s.progress[menu.trackId]?.finished : false));

  if (!menu || !track) return null;
  const liked = track.likedAt !== null;

  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <Sheet onClose={close} label={track.title}>
      <div className="sheet-header">
        <Cover trackId={track.id} hasCover={track.hasCover} />
        <div className="grow">
          <div className="track-title">{track.title}</div>
          <div className="muted small ellipsis">{track.artist}</div>
        </div>
      </div>

      <button className="menu-item" onClick={run(() => usePlayer.getState().playNext([track.id]))}>
        <ListStart size={20} /> {t('track.playNext')}
      </button>
      <button
        className="menu-item"
        onClick={run(() => usePlayer.getState().addToQueue([track.id]))}
      >
        <ListEnd size={20} /> {t('track.addToQueue')}
      </button>
      <button
        className="menu-item"
        onClick={run(() => void useLibrary.getState().toggleLike(track.id))}
      >
        <Heart size={20} fill={liked ? 'currentColor' : 'none'} />
        {liked ? t('track.unlike') : t('track.like')}
      </button>
      <button
        className="menu-item"
        onClick={run(() => useUi.getState().openPlaylistSheet([track.id]))}
      >
        <ListPlus size={20} /> {t('track.addToPlaylist')}
      </button>
      {playlist && (
        <button
          className="menu-item"
          onClick={run(() => void useLibrary.getState().removeFromPlaylist(playlist.id, track.id))}
        >
          <ListX size={20} /> {t('track.removeFromPlaylist')}
        </button>
      )}
      {track.locations.device ? (
        <div className="menu-item" style={{ cursor: 'default' }}>
          <Smartphone size={20} /> {t('track.onDevice')}
        </div>
      ) : offlineMode ? (
        <button
          className="menu-item"
          onClick={run(() => void useOffline.getState().unpin(track.id))}
        >
          <CircleMinus size={20} /> {t('track.removeDownload')}
        </button>
      ) : (
        <button
          className="menu-item"
          onClick={run(() => void useOffline.getState().pin([track.id]))}
        >
          <ArrowDownToLine size={20} /> {t('track.download')}
        </button>
      )}
      {track.kind === 'podcast' && (
        <button
          className="menu-item"
          onClick={run(() => usePodcasts.getState().setFinished(track.id, !finished))}
        >
          <CircleCheck size={20} />{' '}
          {finished ? t('podcasts.markUnplayed') : t('podcasts.markPlayed')}
        </button>
      )}
      <button
        className="menu-item"
        onClick={run(
          () =>
            void useLibrary
              .getState()
              .setKind(track.id, track.kind === 'podcast' ? 'music' : 'podcast'),
        )}
      >
        {track.kind === 'podcast' ? <Music size={20} /> : <Mic size={20} />}
        {track.kind === 'podcast' ? t('track.toMusic') : t('track.toPodcasts')}
      </button>
      <button
        className="menu-item danger"
        onClick={run(async () => {
          const ok = await confirmDialog(
            t('track.deleteConfirm', { title: track.title }),
            t('common.delete'),
            true,
          );
          if (!ok) return;
          await useOffline.getState().unpin(track.id);
          await useLibrary.getState().deleteTrack(track.id);
        })}
      >
        <Trash2 size={20} /> {t('track.delete')}
      </button>
    </Sheet>
  );
}
