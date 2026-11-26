import { useEffect, useMemo, useState } from 'react';
import { Download, ListMusic, Trash2 } from 'lucide-react';
import type { SendItem } from '@aske/shared';
import { youtubeVideoId } from '@aske/shared/youtube';
import { useT } from '../../i18n';
import { useSend } from '../../stores/send';
import { SongThumb } from '../SongThumb';

function sendStatus(t: ReturnType<typeof useT>, item: SendItem): string {
  if (item.status === 'pending') return t('send.st.pending');
  if (item.status === 'taken') return t('send.st.taken');
  if (item.status === 'done') return item.detail || t('send.st.done');
  return item.detail || t('send.st.error');
}

function ItemThumb({ item }: { item: SendItem }) {
  const [broken, setBroken] = useState(false);
  const videoId = item.kind === 'video' ? youtubeVideoId(item.url) : null;
  if (videoId) return <SongThumb videoId={videoId} />;
  if (item.thumbnail && !broken) {
    return (
      <img
        className="dl-thumb"
        src={item.thumbnail}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <div className="dl-thumb station-logo">
      {item.kind === 'playlist' ? <ListMusic size={20} /> : <Download size={20} />}
    </div>
  );
}

/** Computer with a Cloudflare library: list of songs sent to the phone. */
export function Outbox() {
  const t = useT();
  const items = useSend((s) => s.items);
  const loaded = useSend((s) => s.loaded);

  useEffect(() => {
    void useSend.getState().refresh();
    const timer = setInterval(() => void useSend.getState().refresh(), 15_000);
    return () => clearInterval(timer);
  }, []);

  const sorted = useMemo(() => [...items].sort((a, b) => b.createdAt - a.createdAt), [items]);
  if (!loaded) return null;
  return (
    <section>
      <h2 className="section-title">{t('send.listTitle')}</h2>
      {sorted.length === 0 ? (
        <p className="muted small">{t('send.empty')}</p>
      ) : (
        <div className="card-list">
          {sorted.map((item) => (
            <div key={item.id} className="card-row">
              <ItemThumb item={item} />
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="card-title ellipsis">{item.title || item.url}</div>
                <div
                  className={`small ellipsis ${item.status === 'error' ? 'error-text' : 'muted'}`}
                >
                  {sendStatus(t, item)}
                </div>
              </div>
              <span className={`pill ${item.status === 'done' ? 'auto' : ''}`}>
                {t(`send.pill.${item.status}`)}
              </span>
              <button
                className="icon-btn"
                aria-label={t('common.delete')}
                onClick={() => void useSend.getState().remove(item.id)}
              >
                <Trash2 size={18} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
