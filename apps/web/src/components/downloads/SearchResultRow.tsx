import { useState, type ReactNode } from 'react';
import { Check, Download, ListMusic, Plus, Send } from 'lucide-react';
import type { SearchResult } from '@aske/shared/youtube';
import { useT } from '../../i18n';
import { formatTime } from '../../lib/format';
import { isNative } from '../../native/platform';
import { useDownloads } from '../../stores/downloads';
import { useLibrary } from '../../stores/library';
import { songFromResult, useParcel } from '../../stores/parcel';
import { useSend } from '../../stores/send';
import { SongThumb } from '../SongThumb';

/** How this screen works: phone app, computer with Cloudflare, or computer through the Hub. */
export type SendVia = 'cloudflare' | 'hub' | null;

function useInLibrary(videoId: string): boolean {
  return useLibrary((s) =>
    Object.values(s.tracks).some((tr) => tr.source === 'youtube' && tr.sourceRef === videoId),
  );
}

/** Where this result stands (library, queue, sent) and what its button does. */
function useResultState(result: SearchResult, via: SendVia, onOpen: () => void) {
  const inBasket = useParcel((s) => s.basket.some((song) => song.videoId === result.id));
  const inLibrary = useInLibrary(result.kind === 'video' ? result.id : '');
  const queued = useDownloads((s) =>
    s.jobs.some(
      (j) =>
        j.videoId === result.id &&
        ['queued', 'downloading', 'downloaded', 'saving'].includes(j.status),
    ),
  );
  const sendItem = useSend((s) => s.send);
  const [sent, setSent] = useState(false);

  const act = async () => {
    if (result.kind === 'playlist') return onOpen();
    if (via === 'hub') {
      useParcel.getState().add(songFromResult(result));
    } else if (isNative) {
      await useDownloads.getState().enqueue([
        {
          videoId: result.id,
          title: result.title,
          author: result.author,
          thumbnail: result.thumbnail,
        },
      ]);
    } else if (await sendItem(result)) setSent(true);
  };

  return { inBasket, inLibrary, queued, sent, act };
}

export function SearchResultRow({
  result,
  via,
  onOpen,
}: {
  result: SearchResult;
  via: SendVia;
  onOpen: () => void;
}) {
  const t = useT();
  const state = useResultState(result, via, onOpen);

  const meta = [
    result.author,
    result.album,
    result.duration ? formatTime(result.duration) : null,
    result.count ? t('dl.songsCount', { count: result.count }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="card-row dl-result">
      <SongThumb
        className="dl-thumb"
        size={0}
        src={result.thumbnail}
        videoId={result.kind === 'video' ? result.id : null}
        title={result.title}
        artist={result.author}
        kind={result.kind === 'playlist' ? 'playlist' : 'song'}
      />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="card-title ellipsis">
          {result.kind === 'playlist' && <ListMusic size={14} className="muted" />} {result.title}
        </div>
        <div className="muted small ellipsis">{meta}</div>
      </div>
      <ResultAction result={result} via={via} state={state} />
    </div>
  );
}

/** Right end of the row: where the song already is, or the button to get it. */
function ResultAction({
  result,
  via,
  state: { inBasket, inLibrary, queued, sent, act },
}: {
  result: SearchResult;
  via: SendVia;
  state: ReturnType<typeof useResultState>;
}) {
  const t = useT();
  if (inLibrary) {
    return (
      <span className="pill auto">
        <Check size={12} /> {t('dl.inLibrary')}
      </span>
    );
  }
  if (queued) return <span className="pill">{t('dl.inQueue')}</span>;
  if (sent) return <span className="pill auto">{t('send.sentShort')}</span>;
  if (via === 'hub' && inBasket) {
    return (
      <span className="pill auto">
        <Check size={12} /> {t('parcel.added')}
      </span>
    );
  }
  return (
    <button
      className="icon-btn"
      aria-label={actionLabel(t, result, via)}
      onClick={() => void act()}
    >
      {actionIcon(result, via)}
    </button>
  );
}

function actionLabel(t: ReturnType<typeof useT>, result: SearchResult, via: SendVia): string {
  if (result.kind === 'playlist') return t('dl.openPlaylist');
  if (via === 'hub') return t('parcel.add');
  return isNative ? t('dl.download') : t('send.send');
}

function actionIcon(result: SearchResult, via: SendVia): ReactNode {
  if (result.kind === 'playlist') return <ListMusic size={22} />;
  if (via === 'hub') return <Plus size={22} />;
  return isNative ? <Download size={22} /> : <Send size={20} />;
}
