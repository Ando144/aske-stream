import { LoaderCircle, Send, Trash2, X } from 'lucide-react';
import { useT } from '../../i18n';
import { useParcel } from '../../stores/parcel';
import { SongThumb } from '../SongThumb';

/** Computer: songs picked so far and the button that turns them into a code. */
export function ParcelPanel() {
  const t = useT();
  const basket = useParcel((s) => s.basket);
  const busy = useParcel((s) => s.busy);
  if (basket.length === 0) return null;
  return (
    <section>
      <h2 className="section-title">{t('parcel.basketTitle')}</h2>
      <p className="muted small">{t('parcel.basketCount', { count: basket.length })}</p>
      <div className="card-list">
        {basket.map((song) => (
          <div key={song.videoId} className="card-row">
            <SongThumb videoId={song.videoId} title={song.title} artist={song.artist} size={40} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="card-title ellipsis">{song.title}</div>
              <div className="muted small ellipsis">{song.artist}</div>
            </div>
            <button
              className="icon-btn"
              aria-label={t('parcel.remove')}
              onClick={() => useParcel.getState().remove(song.videoId)}
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn small" onClick={() => useParcel.getState().clear()}>
          <Trash2 size={16} /> {t('parcel.clear')}
        </button>
        <button
          className="btn primary small"
          disabled={busy}
          onClick={() => void useParcel.getState().create()}
        >
          {busy ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />}
          {busy ? t('parcel.creating') : t('parcel.create')}
        </button>
      </div>
    </section>
  );
}
