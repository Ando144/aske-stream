import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Check,
  Download,
  ListMusic,
  LoaderCircle,
  Plus,
  ScanLine,
  Search,
  Send,
  Smartphone,
  X,
} from 'lucide-react';
import {
  classifyPlaylistLink,
  isYoutubeUrl,
  youtubePlaylistId,
  youtubeVideoId,
  type SearchKind,
  type SearchResult,
} from '@aske/shared/youtube';
import { api } from '../api/client';
import { SettingsLink } from '../components/SettingsLink';
import { RELEASES_URL } from '../config';
import { useI18n, useT, type Language } from '../i18n';
import { formatBytes, formatTime } from '../lib/format';
import { loadValue, savePref } from '../lib/storage';
import { searchOnPhone } from '../native/downloader';
import { isNative } from '../native/platform';
import { useDownloads } from '../stores/downloads';
import { useLibrary } from '../stores/library';
import { songFromResult, useParcel } from '../stores/parcel';
import { useSend } from '../stores/send';
import { useSetup } from '../stores/setup';
import { toast } from '../stores/ui';
import { hubAvailable, searchViaHub } from '../hub/client';
import { HelpButton } from '../components/HelpSheet';
import { PlaylistPicker } from '../components/downloads/PlaylistPicker';
import { Queue } from '../components/downloads/DownloadQueue';
import { EnginePanel } from '../components/downloads/EnginePanel';
import { Outbox } from '../components/send/Outbox';
import { ParcelPanel } from '../components/send/ParcelPanel';
import { ReceiveSheet } from '../components/send/ReceiveSheet';

/** How this screen works: phone app, computer with Cloudflare, or computer through the Hub. */
type SendVia = 'cloudflare' | 'hub' | null;

function sendViaFor(home: string | undefined): SendVia {
  if (isNative) return null;
  if (home === 'cloudflare') return 'cloudflare';
  return hubAvailable() ? 'hub' : null;
}

/**
 * Find music on YouTube and get it into the library: download on the phone, or from a
 * computer send it to the phone (Cloudflare library) or with a code through the Hub.
 */
export function DownloadView() {
  const t = useT();
  const home = useSetup((s) => s.config?.home);
  const sendVia = sendViaFor(home);

  return (
    <div className="page">
      <header className="page-header">
        <h1>{isNative ? t('dl.title') : t('send.title')}</h1>
        <SettingsLink />
      </header>
      <Intro via={sendVia} />
      {isNative || sendVia ? (
        <>
          {isNative && hubAvailable() && <ReceiveButton />}
          <SearchPanel via={sendVia}>{isNative && <Queue />}</SearchPanel>
          {sendVia === 'cloudflare' && <Outbox />}
          {sendVia === 'hub' && <ParcelPanel />}
          {isNative && <WherePanel />}
          {isNative && <EnginePanel />}
        </>
      ) : (
        <div className="panel dl-explain">
          <Smartphone size={28} color="var(--accent)" />
          <p style={{ margin: 0 }}>{t('send.needsApp')}</p>
          <a className="btn small" href={RELEASES_URL} target="_blank" rel="noreferrer">
            {t('android.download')}
          </a>
        </div>
      )}
    </div>
  );
}

/** Phone: button that opens the "receive songs" sheet (also opened by a #send= link). */
function ReceiveButton() {
  const t = useT();
  const [code, setCode] = useState<string | null>(null);
  const pendingCode = useParcel((s) => s.pendingCode);

  useEffect(() => {
    if (!pendingCode) return;
    setCode(pendingCode);
    useParcel.getState().setPendingCode(null);
  }, [pendingCode]);

  return (
    <>
      <button className="btn small" onClick={() => setCode('')}>
        <ScanLine size={16} /> {t('parcel.receive')}
      </button>
      {code !== null && <ReceiveSheet initialCode={code} onClose={() => setCode(null)} />}
    </>
  );
}

function Intro({ via }: { via: SendVia }) {
  const t = useT();
  const [open, setOpen] = useState(() => !loadValue<boolean>('dl-intro-seen', false));
  if (!open) return null;
  const close = () => {
    savePref('dl-intro-seen', true);
    setOpen(false);
  };
  const hub = via === 'hub';
  return (
    <div className="banner accent dl-intro">
      <div className="grow">
        <strong>
          {isNative ? t('dl.introTitle') : hub ? t('parcel.introTitle') : t('send.introTitle')}
        </strong>
        <p>{isNative ? t('dl.introText') : hub ? t('parcel.introText') : t('send.introText')}</p>
        <p className="small">{t('dl.legal')}</p>
        <HelpButton id={isNative ? 'download-youtube' : hub ? 'send-with-code' : 'send-to-phone'} />
      </div>
      <button className="icon-btn" aria-label={t('common.close')} onClick={close}>
        <X size={18} />
      </button>
    </div>
  );
}

const KINDS: SearchKind[] = ['songs', 'videos', 'playlists'];
const HUB_KINDS: SearchKind[] = ['songs', 'videos'];
async function searchFor(
  via: SendVia,
  q: string,
  kind: SearchKind,
  language: Language,
): Promise<SearchResult[]> {
  if (isNative) return searchOnPhone(q, kind, language);
  if (via === 'hub') return searchViaHub(q, kind === 'videos' ? 'videos' : 'songs', language);
  return (await api.youtubeSearch(q, kind, language)).results;
}

/** Search box on top, its results right below, then `children` (the download queue). */
function SearchPanel({ via, children }: { via: SendVia; children: ReactNode }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('songs');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPlaylist, setOpenPlaylist] = useState<SearchResult | null>(null);
  const searchSeq = useRef(0);

  const link = isYoutubeUrl(query.trim()) ? query.trim() : null;

  const run = async (k = kind) => {
    const q = query.trim();
    if (!q || link) return;
    const seq = ++searchSeq.current;
    setBusy(true);
    setError(null);
    try {
      const found = await searchFor(via, q, k, language);
      if (seq === searchSeq.current) setResults(found);
    } catch {
      if (seq !== searchSeq.current) return;
      setResults(null);
      setError(navigator.onLine ? t('dl.searchFailed') : t('toast.offline'));
    } finally {
      if (seq === searchSeq.current) setBusy(false);
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (value.trim() !== '') return;
    // Invalidate any in-flight search so a late answer cannot repaint results.
    searchSeq.current++;
    setResults(null);
    setError(null);
    setOpenPlaylist(null);
    setBusy(false);
  };

  return (
    <section className="dl-search">
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <Search size={18} />
        <input
          className="input"
          type="search"
          enterKeyHint="search"
          value={query}
          placeholder={t('dl.searchPlaceholder')}
          aria-label={t('dl.searchPlaceholder')}
          onChange={(e) => handleChange(e.target.value)}
        />
      </form>
      {!link && (
        <div
          className="segmented dl-kinds"
          role="radiogroup"
          aria-label={t('dl.searchPlaceholder')}
        >
          {(via === 'hub' ? HUB_KINDS : KINDS).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={kind === k}
              className={kind === k ? 'active' : ''}
              onClick={() => {
                setKind(k);
                if (query.trim()) void run(k);
              }}
            >
              {t(`dl.kind.${k}`)}
            </button>
          ))}
        </div>
      )}

      {link && (
        <LinkCard
          url={link}
          via={via}
          onDone={() => setQuery('')}
          onOpenPlaylist={setOpenPlaylist}
        />
      )}
      {busy && (
        <div className="row muted dl-status">
          <LoaderCircle className="spin" size={18} /> {t('dl.searching')}
        </div>
      )}
      {error && <div className="error-text">{error}</div>}
      {results && !busy && results.length === 0 && <p className="muted">{t('dl.noResults')}</p>}
      {results && !busy && (
        <div className="card-list">
          {results.map((r) => (
            <ResultRow key={r.kind + r.id} result={r} via={via} onOpen={() => setOpenPlaylist(r)} />
          ))}
        </div>
      )}
      {children}
      {openPlaylist && (
        <PlaylistPicker result={openPlaylist} via={via} onClose={() => setOpenPlaylist(null)} />
      )}
    </section>
  );
}

function useInLibrary(videoId: string): boolean {
  return useLibrary((s) =>
    Object.values(s.tracks).some((tr) => tr.source === 'youtube' && tr.sourceRef === videoId),
  );
}

function ResultRow({
  result,
  via,
  onOpen,
}: {
  result: SearchResult;
  via: SendVia;
  onOpen: () => void;
}) {
  const t = useT();
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
      <img
        className="dl-thumb"
        src={result.thumbnail}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="card-title ellipsis">
          {result.kind === 'playlist' && <ListMusic size={14} className="muted" />} {result.title}
        </div>
        <div className="muted small ellipsis">{meta}</div>
      </div>
      {inLibrary ? (
        <span className="pill auto">
          <Check size={12} /> {t('dl.inLibrary')}
        </span>
      ) : queued ? (
        <span className="pill">{t('dl.inQueue')}</span>
      ) : sent ? (
        <span className="pill auto">{t('send.sentShort')}</span>
      ) : via === 'hub' && inBasket ? (
        <span className="pill auto">
          <Check size={12} /> {t('parcel.added')}
        </span>
      ) : (
        <button
          className="icon-btn"
          aria-label={actionLabel(t, result, via)}
          onClick={() => void act()}
        >
          {actionIcon(result, via)}
        </button>
      )}
    </div>
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

const PLAYLIST_ERRORS = { mix: 'pick.err.mix', personal: 'pick.err.personal' } as const;

type LinkKind = ReturnType<typeof classifyPlaylistLink>['kind'];

function LinkNotices({
  videoId,
  kind,
  valid,
  blockedKind,
}: {
  videoId: string | null;
  kind: LinkKind;
  valid: boolean;
  blockedKind: 'mix' | 'personal' | null;
}) {
  const t = useT();
  return (
    <>
      {!valid && !blockedKind && <div className="error-text small">{t('dl.linkInvalid')}</div>}
      {blockedKind && <div className="error-text small">{t(PLAYLIST_ERRORS[blockedKind])}</div>}
      {videoId && kind === 'mix' && <div className="muted small">{t('pick.mixSongOnly')}</div>}
    </>
  );
}

function LinkActionButton({
  via,
  busy,
  disabled,
  onClick,
}: {
  via: SendVia;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const idle =
    via === 'hub' ? <Plus size={16} /> : isNative ? <Download size={16} /> : <Send size={16} />;
  return (
    <button className="btn primary small" disabled={disabled || busy} onClick={onClick}>
      {busy ? <LoaderCircle size={16} className="spin" /> : idle}
      {via === 'hub' ? t('parcel.add') : isNative ? t('dl.download') : t('send.send')}
    </button>
  );
}

/** Sends or downloads the pasted link; returns the busy flag and the click handler. */
function useLinkAction(url: string, via: SendVia, videoId: string | null, onDone: () => void) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const act = async () => {
    if (via === 'hub' && videoId) {
      useParcel.getState().add({ videoId, title: videoId, artist: '' });
      onDone();
      return;
    }
    setBusy(true);
    try {
      if (isNative) {
        const count = await useDownloads.getState().enqueueUrl(url);
        if (count === 0) toast(t('dl.nothingNew'));
      } else {
        await useSend.getState().send({ url, title: '', author: '', thumbnail: '' });
      }
      onDone();
    } catch (err) {
      toast(t('dl.linkFailed'), 'error');
      console.warn(err);
    } finally {
      setBusy(false);
    }
  };
  return { busy, act };
}

/** A pasted YouTube / YouTube Music link. */
function LinkCard({
  url,
  via,
  onDone,
  onOpenPlaylist,
}: {
  url: string;
  via: SendVia;
  onDone: () => void;
  onOpenPlaylist: (result: SearchResult) => void;
}) {
  const t = useT();
  const videoId = youtubeVideoId(url);
  const kind = classifyPlaylistLink(url).kind;
  const isPlaylist = !videoId && kind === 'playlist';
  const valid = !!videoId || isPlaylist;
  const blockedKind = !videoId && (kind === 'mix' || kind === 'personal') ? kind : null;
  const { busy, act } = useLinkAction(url, via, videoId, onDone);

  const openPlaylist = () => {
    onOpenPlaylist({
      kind: 'playlist',
      id: youtubePlaylistId(url) ?? '',
      title: '',
      author: '',
      thumbnail: '',
      url,
    });
    onDone();
  };

  const showOpen = isPlaylist || (!!videoId && kind === 'playlist');
  return (
    <div className="panel dl-link">
      <div className="grow">
        <strong>{isPlaylist ? t('dl.linkPlaylist') : t('dl.linkSong')}</strong>
        <div className="muted small ellipsis">{url}</div>
        <LinkNotices videoId={videoId} kind={kind} valid={valid} blockedKind={blockedKind} />
      </div>
      {showOpen && (
        <button className={isPlaylist ? 'btn primary small' : 'btn small'} onClick={openPlaylist}>
          <ListMusic size={16} /> {t('pick.openPlaylist')}
        </button>
      )}
      {!isPlaylist && !blockedKind && (
        <LinkActionButton via={via} busy={busy} disabled={!valid} onClick={() => void act()} />
      )}
    </div>
  );
}

/** Where downloaded songs go (and, with Cloudflare, whether to keep a copy here). */
function WherePanel() {
  const t = useT();
  const keepOffline = useDownloads((s) => s.keepOffline);
  const home = useSetup((s) => s.config?.home);
  const [used, setUsed] = useState<{ used: number; limit: number } | null>(null);
  const jobsDone = useDownloads((s) => s.jobs.filter((j) => j.status === 'done').length);
  useEffect(() => {
    if (home !== 'cloudflare') return;
    api
      .storage()
      .then((st) => setUsed({ used: st.usedBytes, limit: st.limitBytes }))
      .catch(() => undefined);
  }, [home, jobsDone]);
  return (
    <div className="panel dl-where small">
      <div>
        {home === 'cloudflare'
          ? t('dl.whereCloud')
          : home === 'drive'
            ? t('dl.whereDrive')
            : t('dl.whereDevice')}
      </div>
      {(home === 'cloudflare' || home === 'drive') && (
        <label className="row" style={{ marginTop: 8 }}>
          <input
            type="checkbox"
            checked={keepOffline}
            onChange={(e) => useDownloads.getState().setKeepOffline(e.target.checked)}
          />
          {t('dl.keepOffline')}
        </label>
      )}
    </div>
  );
}
