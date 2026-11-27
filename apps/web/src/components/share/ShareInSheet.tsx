import { useEffect, useState, type ReactNode } from 'react';
import { Download } from 'lucide-react';
import { useT, type MessageKey } from '../../i18n';
import { fetchVideoInfo } from '../../native/shareTarget';
import type { SharedLink } from '../../share/sharedLink';
import { useDownloads } from '../../stores/downloads';
import { useLibrary } from '../../stores/library';
import { useShareIn } from '../../stores/shareIn';
import { toast } from '../../stores/ui';
import { PlaylistPicker } from '../downloads/PlaylistPicker';
import { Sheet } from '../Sheet';
import { SongThumb, youtubeThumb } from '../SongThumb';
import '../../shareIn.css';

type VideoLink = Extract<SharedLink, { kind: 'video' }>;
type RejectedLink = Extract<SharedLink, { kind: 'blocked' | 'invalid' }>;
type VideoInfo = Awaited<ReturnType<typeof fetchVideoInfo>>;

/** What to do with a link shared from YouTube (or why it cannot be downloaded). */
export function ShareInSheet() {
  const link = useShareIn((s) => s.pending);
  const clear = useShareIn((s) => s.clear);

  if (!link) return null;
  if (link.kind === 'video') return <VideoSheet key={link.videoId} link={link} />;
  if (link.kind === 'playlist') {
    const result = {
      kind: 'playlist' as const,
      id: link.playlistId,
      title: '',
      author: '',
      thumbnail: '',
      url: link.url,
    };
    return <PlaylistPicker key={link.playlistId} result={result} via={null} onClose={clear} />;
  }
  return <RejectedSheet link={link} />;
}

/** `undefined` while YouTube is being asked; `null` if it did not tell. */
function useVideoInfo(videoId: string): VideoInfo | undefined {
  const [info, setInfo] = useState<VideoInfo | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void fetchVideoInfo(videoId).then((found) => {
      if (alive) setInfo(found);
    });
    return () => {
      alive = false;
    };
  }, [videoId]);
  return info;
}

function useDownloadShared(link: VideoLink, title: string, author: string) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    const { videoId } = link;
    try {
      await useDownloads
        .getState()
        .enqueue([{ videoId, title, author, thumbnail: youtubeThumb(videoId) }]);
      toast(t('shareIn.added'));
      // Another link may have arrived meanwhile: that one stays on screen.
      if (useShareIn.getState().pending === link) useShareIn.getState().clear();
    } catch (err) {
      console.error('Could not queue the shared video', err);
      toast(t('dl.linkFailed'), 'error');
      setBusy(false);
    }
  };
  return { busy, download };
}

function VideoSheet({ link }: { link: VideoLink }) {
  const t = useT();
  const clear = useShareIn((s) => s.clear);
  const info = useVideoInfo(link.videoId);
  const inLibrary = useLibrary((s) =>
    Object.values(s.tracks).some((tr) => tr.source === 'youtube' && tr.sourceRef === link.videoId),
  );
  const title = info?.title ?? t('shareIn.unknownTitle');
  const author = info?.author ?? '';
  const { busy, download } = useDownloadShared(link, title, author);

  return (
    <ShareFrame onClose={clear}>
      <SongThumb
        videoId={link.videoId}
        title={title}
        artist={author}
        size={160}
        className="cover share-in-thumb"
      />
      <div className="share-in-text" aria-live="polite">
        <div className="card-title">{info === undefined ? t('shareIn.loading') : title}</div>
        {author && <div className="muted small">{author}</div>}
        {info === null && <div className="muted small">{t('shareIn.infoFailed')}</div>}
        {inLibrary && <span className="pill auto">{t('dl.inLibrary')}</span>}
      </div>
      <div className="share-in-actions">
        <button type="button" className="btn" onClick={clear}>
          {t('common.cancel')}
        </button>
        {!inLibrary && (
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => void download()}
          >
            <Download size={16} aria-hidden />
            {t('shareIn.download')}
          </button>
        )}
      </div>
    </ShareFrame>
  );
}

function RejectedSheet({ link }: { link: RejectedLink }) {
  const t = useT();
  const clear = useShareIn((s) => s.clear);
  const message: MessageKey =
    link.kind === 'blocked' ? `pick.err.${link.reason}` : 'shareIn.notYoutube';

  return (
    <ShareFrame onClose={clear}>
      <p className="share-in-text">{t(message)}</p>
      <div className="share-in-actions">
        <button type="button" className="btn primary" onClick={clear}>
          {t('shareIn.ok')}
        </button>
      </div>
    </ShareFrame>
  );
}

function ShareFrame({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const t = useT();
  return (
    <Sheet onClose={onClose} label={t('shareIn.title')}>
      <div className="sheet-header">
        <strong className="grow">{t('shareIn.title')}</strong>
      </div>
      <div className="share-in">{children}</div>
    </Sheet>
  );
}
