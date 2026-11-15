import { X } from 'lucide-react';
import { useT } from '../../i18n';
import { useLibrary } from '../../stores/library';
import { usePlayer } from '../../stores/player';
import { Cover } from '../Cover';
import { SortableList } from '../Sortable';

/** How many upcoming songs to render (long libraries would make the sheet heavy). */
const UPCOMING_LIMIT = 80;

/**
 * Two sections, like a real player:
 *  1. Queue — songs you added; they always play first.
 *  2. Next from … — the rest of the list you pressed play on.
 * Both can be reordered by dragging the ⠿ handle, and items can be removed.
 */
export function QueuePanel() {
  const t = useT();
  const queue = usePlayer((s) => s.queue);
  const context = usePlayer((s) => s.context);
  const index = usePlayer((s) => s.index);
  const contextInfo = usePlayer((s) => s.contextInfo);
  const tracks = useLibrary((s) => s.tracks);
  const p = usePlayer.getState();
  const upcoming = context.slice(index + 1, index + 1 + UPCOMING_LIMIT);

  const row = (id: string, handle: React.ReactNode, onPlay: () => void, onRemove: () => void) => {
    const track = tracks[id];
    if (!track) return null;
    return (
      <div className="queue-item">
        {handle}
        <button className="row grow" style={{ gap: 10, textAlign: 'left' }} onClick={onPlay}>
          <Cover trackId={id} hasCover={track.hasCover} size={40} />
          <div className="grow">
            <div className="track-title small">{track.title}</div>
            <div className="muted small ellipsis">{track.artist}</div>
          </div>
        </button>
        <button className="icon-btn" onClick={onRemove} aria-label={t('queue.remove')}>
          <X size={18} />
        </button>
      </div>
    );
  };

  return (
    <section className="queue-panel">
      {queue.length > 0 && (
        <>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title" style={{ margin: '8px 0' }}>
              {t('queue.title')}
            </h2>
            <button className="btn small" onClick={p.clearQueue}>
              {t('queue.clear')}
            </button>
          </div>
          <SortableList
            items={queue}
            keyOf={(id, i) => `q${i}-${id}`}
            onMove={p.moveInQueue}
            handleLabel={t('queue.drag')}
            render={(id, i, handle) =>
              row(
                id,
                handle,
                () => p.playFromQueue(i),
                () => p.removeFromQueue(i),
              )
            }
          />
        </>
      )}

      <h2 className="section-title" style={{ margin: '14px 0 8px' }}>
        {contextInfo ? t('queue.nextFrom', { name: contextInfo.label }) : t('queue.next')}
      </h2>
      {upcoming.length === 0 && queue.length === 0 && (
        <p className="muted small">{t('queue.empty')}</p>
      )}
      <SortableList
        items={upcoming}
        keyOf={(id, i) => `c${index + 1 + i}-${id}`}
        onMove={p.moveUpcoming}
        handleLabel={t('queue.drag')}
        render={(id, i, handle) =>
          row(
            id,
            handle,
            () => p.playAt(index + 1 + i),
            () => p.removeUpcoming(i),
          )
        }
      />
      {(queue.length > 0 || upcoming.length > 1) && (
        <p className="faint small">{t('queue.hint')}</p>
      )}
    </section>
  );
}
