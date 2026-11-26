import { useState } from 'react';
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
  Pencil,
  Send,
  Trash2,
  Users,
} from 'lucide-react';
import { hubAvailable } from '../hub/client';
import { addTracksToJam, jamIsActive } from '../hub/jamFromLibrary';
import { useT } from '../i18n';
import { isOnlyOnDevice } from '../storage/localExtras';
import type { LocalTrack } from '../storage/types';
import { useJam } from '../stores/jam';
import { useParcel } from '../stores/parcel';
import { useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { usePodcasts } from '../stores/podcasts';
import { usePlayer } from '../stores/player';
import { useSetup } from '../stores/setup';
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
  const toJam = useJam(() => jamIsActive());
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
      <StorageItem track={track} />
      {toJam && track.kind !== 'podcast' && (
        <button className="menu-item" onClick={run(() => addTracksToJam([track.id]))}>
          <Users size={20} /> {t('jamSend.action')}
        </button>
      )}
      {hubAvailable() && track.kind !== 'podcast' && (
        <button
          className="menu-item"
          onClick={run(() => void useParcel.getState().sendTracks([track.id]))}
        >
          <Send size={20} /> {t('parcel.sendSelected')}
        </button>
      )}
      {track.kind === 'podcast' && (
        <button
          className="menu-item"
          onClick={run(() => useUi.getState().openShowPicker([track.id]))}
        >
          <Pencil size={20} /> {t('podcasts.changeShow')}
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

/** Where the song is: only on this phone, on this device, or downloadable for offline use. */
function StorageItem({ track }: { track: LocalTrack }) {
  const t = useT();
  const home = useSetup((s) => s.config?.home);
  const offlineMode = useOffline((s) => s.entries[track.id]?.mode);
  const close = useUi((s) => s.closeTrackMenu);
  const [explaining, setExplaining] = useState(false);

  if (isOnlyOnDevice(track, home)) {
    return (
      <>
        <button
          className="menu-item"
          onClick={() => setExplaining(!explaining)}
          aria-expanded={explaining}
        >
          <Smartphone size={20} /> {t('local.badge')}
        </button>
        {explaining && <p className="menu-explain muted small">{t('local.explain')}</p>}
      </>
    );
  }
  if (track.locations.device) {
    return (
      <div className="menu-item" style={{ cursor: 'default' }}>
        <Smartphone size={20} /> {t('track.onDevice')}
      </div>
    );
  }
  const toggle = () => {
    close();
    const offline = useOffline.getState();
    void (offlineMode ? offline.unpin(track.id) : offline.pin([track.id]));
  };
  return (
    <button className="menu-item" onClick={toggle}>
      {offlineMode ? <CircleMinus size={20} /> : <ArrowDownToLine size={20} />}{' '}
      {offlineMode ? t('track.removeDownload') : t('track.download')}
    </button>
  );
}
