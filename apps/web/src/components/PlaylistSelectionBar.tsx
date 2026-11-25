import { ArrowDownToLine, CheckCheck, ListEnd, Send, X } from 'lucide-react';
import { hubAvailable } from '../hub/client';
import { useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { trackIdsOfPlaylists, useParcel } from '../stores/parcel';
import { usePlayer } from '../stores/player';
import { useUi } from '../stores/ui';
import '../playlistSelect.css';

/** Actions for several playlists at once; shown while selecting on the Playlists screen. */
export function PlaylistSelectionBar() {
  const t = useT();
  const selection = useUi((s) => s.playlistSelection);
  const playlists = useLibrary((s) => s.playlists);
  const selectable = useUi((s) => s.playlistVisibleIds);
  const tracks = useLibrary((s) => s.tracks);
  if (!selection) return null;

  const ui = useUi.getState();
  const trackIds = trackIdsOfPlaylists(playlists, selection);
  const cloudIds = trackIds.filter((id) => tracks[id] && !tracks[id]!.locations.device);
  const count = selection.length;
  const label = count === 1 ? t('plsel.count.one') : t('plsel.count', { count });

  return (
    <div className="selection-bar" role="toolbar" aria-label={label}>
      <div className="row">
        <button
          className="icon-btn"
          onClick={ui.endPlaylistSelection}
          aria-label={t('select.cancel')}
        >
          <X size={20} />
        </button>
        <strong className="grow">{label}</strong>
        <button
          className="btn small"
          onClick={() => ui.selectAllPlaylists(selectable)}
          disabled={selectable.length === 0}
        >
          <CheckCheck size={16} /> {t('select.all')}
        </button>
      </div>
      <div className="selection-actions">
        {hubAvailable() && (
          <button
            disabled={count === 0}
            onClick={async () => {
              if (await useParcel.getState().sendPlaylists(selection)) ui.endPlaylistSelection();
            }}
          >
            <Send size={20} />
            {t('parcel.sendSelected')}
          </button>
        )}
        <button
          disabled={trackIds.length === 0}
          onClick={() => {
            usePlayer.getState().addToQueue(trackIds);
            ui.endPlaylistSelection();
          }}
        >
          <ListEnd size={20} />
          {t('plsel.queue')}
        </button>
        <button
          disabled={cloudIds.length === 0}
          onClick={() => {
            void useOffline.getState().pin(cloudIds);
            ui.endPlaylistSelection();
          }}
        >
          <ArrowDownToLine size={20} />
          {t('plsel.download')}
        </button>
      </div>
    </div>
  );
}
