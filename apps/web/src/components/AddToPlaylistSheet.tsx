import { Check, ListMusic, Plus } from 'lucide-react';
import { songCount, useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { promptDialog, useUi } from '../stores/ui';
import { Sheet } from './Sheet';

/**
 * Lists every playlist with a check mark when it already contains the
 * song(s). Tapping toggles membership, so the same sheet adds and removes.
 */
export function AddToPlaylistSheet() {
  const trackIds = useUi((s) => s.playlistSheet);
  const close = useUi((s) => s.closePlaylistSheet);
  const playlists = useLibrary((s) => s.playlists);
  const t = useT();

  if (!trackIds) return null;

  const createNew = async () => {
    const name = await promptDialog({
      title: t('playlists.new'),
      placeholder: t('playlists.namePlaceholder'),
      initial: '',
      confirmLabel: t('common.create'),
    });
    if (name) await useLibrary.getState().createPlaylist(name, trackIds);
    close();
  };

  return (
    <Sheet onClose={close} label={t('sheet.addToPlaylist')}>
      <div className="sheet-header">
        <strong className="grow">{t('sheet.addToPlaylist')}</strong>
      </div>
      <button className="menu-item" onClick={() => void createNew()}>
        <Plus size={20} /> {t('playlists.new')}
      </button>
      {playlists.map((pl) => {
        const contains = trackIds.every((id) => pl.trackIds.includes(id));
        const toggle = async () => {
          close();
          const lib = useLibrary.getState();
          if (contains && trackIds.length === 1) await lib.removeFromPlaylist(pl.id, trackIds[0]!);
          else await lib.addToPlaylist(pl.id, trackIds);
        };
        return (
          <button
            key={pl.id}
            className="menu-item"
            onClick={() => void toggle()}
            aria-pressed={contains}
          >
            <ListMusic size={20} />
            <span className="grow">
              <span className="ellipsis" style={{ display: 'block' }}>
                {pl.name}
              </span>
              <span className="faint small">{songCount(t, pl.trackIds.length)}</span>
            </span>
            {contains && (
              <Check size={20} color="var(--accent)" aria-label={t('sheet.inPlaylist')} />
            )}
          </button>
        );
      })}
    </Sheet>
  );
}
