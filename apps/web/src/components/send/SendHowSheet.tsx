import { createPortal } from 'react-dom';
import { useLocation } from 'wouter';
import { HelpButton } from '../HelpSheet';
import { useT } from '../../i18n';

/** Phone: explains the three ways to send songs to another phone. */
export function SendHowSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [, navigate] = useLocation();

  const pick = () => {
    onClose();
    navigate('/?select=1');
  };
  const goPlaylists = () => {
    onClose();
    navigate('/playlists');
  };

  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div className="sheet dl-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <strong>{t('parcel.sendHowTitle')}</strong>
        <p className="small">{t('parcel.sendHowSelect')}</p>
        <div>
          <button className="btn primary small" type="button" onClick={pick}>
            {t('parcel.sendPick')}
          </button>
        </div>
        <p className="small">{t('parcel.sendHowQueue')}</p>
        <p className="small">{t('parcel.sendHowPlaylist')}</p>
        <div>
          <button className="btn small" type="button" onClick={goPlaylists}>
            {t('parcel.sendGoPlaylists')}
          </button>
        </div>
        <p className="muted small">{t('parcel.sendHowNote')}</p>
        <HelpButton id="send-with-code" />
      </div>
    </div>,
    document.body,
  );
}
