import { useState } from 'react';
import type { Playlist } from '@aske/shared';
import { songCount, useT } from '../../i18n';
import { useLibrary } from '../../stores/library';
import { SharePlaylistSheet } from '../SharePlaylistSheet';
import { Sheet } from '../Sheet';

/** Pick which playlist to share, then show its link and QR. */
export function SharePickSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const playlists = useLibrary((s) => s.playlists);
  const [picked, setPicked] = useState<Playlist | null>(null);

  if (picked) return <SharePlaylistSheet playlist={picked} onClose={onClose} />;

  return (
    <Sheet onClose={onClose} label={t('share.pickTitle')}>
      <div className="sheet-header">
        <div className="track-title grow">{t('share.pickTitle')}</div>
      </div>
      <div className="sheet-body">
        {playlists.length === 0 ? (
          <p className="muted">{t('share.pickEmpty')}</p>
        ) : (
          <div className="card-list">
            {playlists.map((pl) => (
              <button key={pl.id} className="card-row" onClick={() => setPicked(pl)}>
                <div className="grow">
                  <div className="card-title ellipsis">{pl.name}</div>
                  <div className="muted small">{songCount(t, pl.trackIds.length)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}
