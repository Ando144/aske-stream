import { ArrowDownToLine, CheckCheck, Heart, ListEnd, ListPlus, Plus, Send, X } from 'lucide-react';
import { useLocation } from 'wouter';
import { hubAvailable } from '../hub/client';
import { useT } from '../i18n';
import { useParcel } from '../stores/parcel';
import { useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { usePlayer } from '../stores/player';
import { useUi } from '../stores/ui';

/**
 * Actions for many songs at once. Appears while selecting (long press on a
 * song, or the "Select" button). When picking songs for a playlist it shows a
 * single big "Add to …" button instead.
 */
export function SelectionBar() {
  const t = useT();
  const [, navigate] = useLocation();
  const selection = useUi((s) => s.selection);
  const target = useUi((s) => s.selectionTarget);
  const visible = useUi((s) => s.visibleIds.length);
  const tracks = useLibrary((s) => s.tracks);
  if (!selection) return null;

  const ids = selection;
  const ui = useUi.getState();
  const done = () => ui.endSelection();
  const cloudIds = ids.filter((id) => tracks[id] && !tracks[id]!.locations.device);

  return (
    <div
      className="selection-bar"
      role="toolbar"
      aria-label={t('select.count', { count: ids.length })}
    >
      <div className="row">
        <button
          className="icon-btn"
          onClick={() => {
            done();
            if (target) navigate(`/playlist/${target.playlistId}`);
          }}
          aria-label={t('select.cancel')}
        >
          <X size={20} />
        </button>
        <strong className="grow">{t('select.count', { count: ids.length })}</strong>
        <button className="btn small" onClick={ui.selectAll} disabled={!visible}>
          <CheckCheck size={16} /> {t('select.all')}
        </button>
      </div>
      {target ? (
        <button
          className="btn primary"
          disabled={!ids.length}
          onClick={async () => {
            await useLibrary.getState().addToPlaylist(target.playlistId, ids);
            done();
            navigate(`/playlist/${target.playlistId}`);
          }}
        >
          <Plus size={18} /> {t('select.addTo', { name: target.name })}
        </button>
      ) : (
        <div className="selection-actions">
          <button
            disabled={!ids.length}
            onClick={() => {
              ui.openPlaylistSheet(ids);
              done();
            }}
          >
            <ListPlus size={20} />
            {t('select.addToPlaylist')}
          </button>
          <button
            disabled={!ids.length}
            onClick={() => {
              usePlayer.getState().addToQueue(ids);
              done();
            }}
          >
            <ListEnd size={20} />
            {t('select.queue')}
          </button>
          <button
            disabled={!ids.length}
            onClick={() => {
              void useLibrary.getState().likeMany(ids);
              done();
            }}
          >
            <Heart size={20} />
            {t('select.like')}
          </button>
          {hubAvailable() && (
            <button
              disabled={!ids.length}
              onClick={async () => {
                if (await useParcel.getState().sendTracks(ids)) done();
              }}
            >
              <Send size={20} />
              {t('parcel.sendSelected')}
            </button>
          )}
          <button
            disabled={!cloudIds.length}
            onClick={() => {
              void useOffline.getState().pin(cloudIds);
              done();
            }}
          >
            <ArrowDownToLine size={20} />
            {t('select.download')}
          </button>
        </div>
      )}
    </div>
  );
}
