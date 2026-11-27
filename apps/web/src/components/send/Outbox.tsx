import { useEffect, useMemo } from 'react';
import { Trash2 } from 'lucide-react';
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
  const videoId = item.kind === 'video' ? youtubeVideoId(item.url) : null;
  const title = item.title || item.url;
  if (videoId) return <SongThumb videoId={videoId} title={title} artist={item.author} />;
  return (
    <SongThumb
      src={item.thumbnail}
      title={title}
      artist={item.author}
      kind={item.kind === 'playlist' ? 'playlist' : 'song'}
      size={0}
      className="dl-thumb"
    />
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
