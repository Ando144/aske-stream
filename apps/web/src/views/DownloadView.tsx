import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  BatteryWarning,
  Check,
  CircleAlert,
  Download,
  ListMusic,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import type { SendItem } from '@aske/shared';
import {
  isYoutubeUrl,
  youtubePlaylistId,
  youtubeVideoId,
  type SearchKind,
  type SearchResult,
} from '@aske/shared/youtube';
import { api } from '../api/client';
import { SettingsLink } from '../components/SettingsLink';
import { RELEASES_URL } from '../config';
import { useI18n, useT } from '../i18n';
import { formatBytes, formatTime } from '../lib/format';
import { loadValue, savePref } from '../lib/storage';
import { AskeNative } from '../native/askeNative';
import { listPlaylistOnPhone, searchOnPhone } from '../native/downloader';
import { isNative } from '../native/platform';
import { useDownloads, type DownloadJob } from '../stores/downloads';
import { useLibrary } from '../stores/library';
import { useSend } from '../stores/send';
import { useSetup } from '../stores/setup';
import { toast } from '../stores/ui';

/**
 * Find music on YouTube and get it into the library.
 *  - Android app: search and download right here.
 *  - Computer (Cloudflare library): search and "Send to phone"; the phone
 *    downloads it next time it is open.
 */
export function DownloadView() {
  const t = useT();
  const home = useSetup((s) => s.config?.home);
  const canSend = !isNative && home === 'cloudflare';

  return (
    <div className="page">
      <header className="page-header">
        <h1>{isNative ? t('dl.title') : t('send.title')}</h1>
        <SettingsLink />
      </header>
      <Intro />
      {isNative || canSend ? (
        <>
          <SearchPanel>{isNative && <Queue />}</SearchPanel>
          {!isNative && <Outbox />}
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

/** Plain-language explanation, shown until dismissed. */
function Intro() {
  const t = useT();
  const [open, setOpen] = useState(() => !loadValue<boolean>('dl-intro-seen', false));
  if (!open) return null;
  const close = () => {
    savePref('dl-intro-seen', true);
    setOpen(false);
  };
  return (
    <div className="banner accent dl-intro">
      <div className="grow">
        <strong>{isNative ? t('dl.introTitle') : t('send.introTitle')}</strong>
        <p>{isNative ? t('dl.introText') : t('send.introText')}</p>
        <p className="small">{t('dl.legal')}</p>
      </div>
      <button className="icon-btn" aria-label={t('common.close')} onClick={close}>
        <X size={18} />
      </button>
    </div>
  );
}

const KINDS: SearchKind[] = ['songs', 'videos', 'playlists'];

/** Search box on top, its results right below, then `children` (the download queue). */
function SearchPanel({ children }: { children: ReactNode }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('songs');
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openPlaylist, setOpenPlaylist] = useState<SearchResult | null>(null);

  const link = isYoutubeUrl(query.trim()) ? query.trim() : null;

  const run = async (k = kind) => {
    const q = query.trim();
    if (!q || link) return;
    setBusy(true);
    setError(null);
    try {
      const found = isNative
        ? await searchOnPhone(q, k, language)
        : (await api.youtubeSearch(q, k, language)).results;
      setResults(found);
    } catch {
      setResults(null);
      setError(navigator.onLine ? t('dl.searchFailed') : t('toast.offline'));
    } finally {
      setBusy(false);
    }
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
          onChange={(e) => setQuery(e.target.value)}
        />
      </form>
      {!link && (
        <div
          className="segmented dl-kinds"
          role="radiogroup"
          aria-label={t('dl.searchPlaceholder')}
        >
          {KINDS.map((k) => (
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

      {link && <LinkCard url={link} onDone={() => setQuery('')} />}
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
            <ResultRow key={r.kind + r.id} result={r} onOpen={() => setOpenPlaylist(r)} />
          ))}
        </div>
      )}
      {children}
      {openPlaylist && (
        <PlaylistSheet result={openPlaylist} onClose={() => setOpenPlaylist(null)} />
      )}
    </section>
  );
}

function useInLibrary(videoId: string): boolean {
  return useLibrary((s) =>
    Object.values(s.tracks).some((tr) => tr.source === 'youtube' && tr.sourceRef === videoId),
  );
}

function ResultRow({ result, onOpen }: { result: SearchResult; onOpen: () => void }) {
  const t = useT();
  const inLibrary = useInLibrary(result.kind === 'video' ? result.id : '');
  const queued = useDownloads((s) =>
    s.jobs.some(
      (j) =>
        j.videoId === result.id &&
        (j.status === 'queued' || j.status === 'downloading' || j.status === 'saving'),
    ),
  );
  const sendItem = useSend((s) => s.send);
  const [sent, setSent] = useState(false);

  const act = async () => {
    if (result.kind === 'playlist') return onOpen();
    if (isNative) {
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
      ) : (
        <button
          className="icon-btn"
          aria-label={
            result.kind === 'playlist'
              ? t('dl.openPlaylist')
              : isNative
                ? t('dl.download')
                : t('send.send')
          }
          onClick={() => void act()}
        >
          {result.kind === 'playlist' ? (
            <ListMusic size={22} />
          ) : isNative ? (
            <Download size={22} />
          ) : (
            <Send size={20} />
          )}
        </button>
      )}
    </div>
  );
}

/** A pasted YouTube / YouTube Music link. */
function LinkCard({ url, onDone }: { url: string; onDone: () => void }) {
  const t = useT();
  const isPlaylist = !youtubeVideoId(url) && !!youtubePlaylistId(url);
  const [busy, setBusy] = useState(false);
  const valid = !!youtubeVideoId(url) || isPlaylist;

  const act = async () => {
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

  return (
    <div className="panel dl-link">
      <div className="grow">
        <strong>{isPlaylist ? t('dl.linkPlaylist') : t('dl.linkSong')}</strong>
        <div className="muted small ellipsis">{url}</div>
        {!valid && <div className="error-text small">{t('dl.linkInvalid')}</div>}
      </div>
      <button className="btn primary small" disabled={!valid || busy} onClick={() => void act()}>
        {busy ? (
          <LoaderCircle size={16} className="spin" />
        ) : isNative ? (
          <Download size={16} />
        ) : (
          <Send size={16} />
        )}
        {isNative ? t('dl.download') : t('send.send')}
      </button>
    </div>
  );
}

/** Preview of a playlist before downloading (phone) or sending it (computer). */
function PlaylistSheet({ result, onClose }: { result: SearchResult; onClose: () => void }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const [entries, setEntries] = useState<{ id: string; title: string; author: string }[] | null>(
    null,
  );
  const [title, setTitle] = useState(result.title);
  const [error, setError] = useState<string | null>(null);
  const [makePlaylist, setMakePlaylist] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    let alive = true;
    listPlaylistOnPhone(result.url, language)
      .then((l) => {
        if (!alive) return;
        if (l.title) setTitle(l.title);
        setEntries(l.entries);
        if (!l.entries.length) setError(t('dl.playlistEmpty'));
      })
      .catch((err: Error) => {
        if (!alive) return;
        setEntries([]);
        setError(
          err.message === 'timeout'
            ? t('dl.playlistSlow')
            : `${t('dl.playlistFailed')} (${err.message})`,
        );
      });
    return () => {
      alive = false;
    };
  }, [result.url]);

  const go = async () => {
    setBusy(true);
    if (isNative && entries) {
      await useDownloads.getState().enqueue(
        entries.map((e) => ({ videoId: e.id, title: e.title, author: e.author })),
        { playlistName: makePlaylist ? title : undefined },
      );
    } else if (!isNative) {
      await useSend.getState().send(result);
    }
    setBusy(false);
    onClose();
  };

  // Rendered on <body> so it sits above the tab bar and the player, like the other sheets.
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div className="sheet dl-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="row">
          <img className="dl-thumb" src={result.thumbnail} alt="" referrerPolicy="no-referrer" />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="card-title">{result.title}</div>
            <div className="muted small">
              {[result.author, result.count ? t('dl.songsCount', { count: result.count }) : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
        {isNative && !entries && !error && (
          <div className="row muted dl-status">
            <LoaderCircle className="spin" size={18} /> {t('dl.loadingPlaylist')}
          </div>
        )}
        {error && <div className="error-text small">{error}</div>}
        {entries && entries.length > 0 && (
          <div className="dl-entries">
            {entries.map((e, i) => (
              <div key={e.id} className="small ellipsis">
                <span className="faint">{i + 1}.</span> {e.title}
              </div>
            ))}
          </div>
        )}
        {isNative && (
          <label className="row small">
            <input
              type="checkbox"
              checked={makePlaylist}
              onChange={(e) => setMakePlaylist(e.target.checked)}
            />
            {t('dl.makePlaylist', { name: title })}
          </label>
        )}
        {!isNative && <p className="small muted">{t('send.playlistHint')}</p>}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn small" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className="btn primary small"
            disabled={busy || (isNative && !entries?.length)}
            onClick={() => void go()}
          >
            {isNative ? <Download size={16} /> : <Send size={16} />}
            {isNative
              ? t('dl.downloadAll', { count: entries?.length ?? 0 })
              : t('send.sendPlaylist')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------- phone queue ------------------------------- */

function statusText(t: ReturnType<typeof useT>, j: DownloadJob): string {
  switch (j.status) {
    case 'queued':
      return t('dl.st.queued');
    case 'downloading':
      return t('dl.st.downloading', { percent: Math.round(j.progress) });
    case 'saving':
      return t('dl.st.saving');
    case 'done':
      return t('dl.st.done');
    case 'skipped':
      return t('dl.st.skipped');
    case 'canceled':
      return t('dl.st.canceled');
    default:
      return j.error ?? t('dl.err.generic');
  }
}

function Queue() {
  const t = useT();
  const jobs = useDownloads((s) => s.jobs);
  const [showDone, setShowDone] = useState(false);

  const active = jobs.filter(
    (j) => j.status === 'queued' || j.status === 'downloading' || j.status === 'saving',
  );
  const failed = jobs.filter((j) => j.status === 'error');
  const finished = jobs.filter((j) => !active.includes(j) && j.status !== 'error').reverse();

  return (
    <>
      {active.length > 0 && <BatteryHint />}
      {(active.length > 0 || failed.length > 0) && (
        <section>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title">
              {active.length ? t('dl.queueTitle', { count: active.length }) : t('dl.failedTitle')}
            </h2>
            <div className="row">
              {failed.length > 0 && (
                <button className="btn small" onClick={() => useDownloads.getState().retryFailed()}>
                  <RotateCcw size={16} /> {t('dl.retryAll')}
                </button>
              )}
              {active.length > 0 && (
                <button
                  className="btn small"
                  onClick={() => void useDownloads.getState().cancelAll()}
                >
                  <X size={16} /> {t('dl.cancelAll')}
                </button>
              )}
            </div>
          </div>
          <div className="card-list">
            {[...active, ...failed].map((j) => (
              <JobRow key={j.id} job={j} />
            ))}
          </div>
        </section>
      )}

      {finished.length > 0 && (
        <section>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button className="section-title link-btn" onClick={() => setShowDone(!showDone)}>
              {t('dl.finishedTitle', { count: finished.length })} {showDone ? '▾' : '▸'}
            </button>
            <button className="btn small" onClick={() => useDownloads.getState().clearFinished()}>
              <Trash2 size={16} /> {t('dl.clearList')}
            </button>
          </div>
          {showDone && (
            <div className="card-list">
              {finished.slice(0, 100).map((j) => (
                <JobRow key={j.id} job={j} />
              ))}
            </div>
          )}
        </section>
      )}
    </>
  );
}

function JobRow({ job }: { job: DownloadJob }) {
  const t = useT();
  const preparing = useDownloads(
    (s) =>
      job.status === 'queued' &&
      s.running &&
      (s.engine.status === 'starting' || s.engine.status === 'updating') &&
      s.jobs.find((j) => j.status === 'queued')?.id === job.id,
  );
  const active = job.status === 'queued' || job.status === 'downloading' || job.status === 'saving';
  return (
    <div className={`card-row dl-job ${job.status}`}>
      <img
        className="dl-thumb"
        src={job.thumbnail}
        alt=""
        loading="lazy"
        referrerPolicy="no-referrer"
      />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="card-title ellipsis">{job.title}</div>
        <div className={`small ${job.status === 'error' ? 'error-text' : 'muted ellipsis'}`}>
          {job.status === 'error' && <CircleAlert size={12} />}{' '}
          {preparing ? t('dl.st.preparing') : statusText(t, job)}
        </div>
        {job.status === 'downloading' && (
          <div className="meter dl-meter" aria-hidden>
            <div className="auto" style={{ width: `${job.progress}%` }} />
          </div>
        )}
      </div>
      {active ? (
        <button
          className="icon-btn"
          aria-label={t('common.cancel')}
          onClick={() => void useDownloads.getState().cancel(job.id)}
        >
          <X size={20} />
        </button>
      ) : job.status === 'error' || job.status === 'canceled' ? (
        <button
          className="icon-btn"
          aria-label={t('dl.retry')}
          onClick={() => useDownloads.getState().retry(job.id)}
        >
          <RotateCcw size={20} />
        </button>
      ) : (
        <Check size={20} color="var(--accent)" />
      )}
    </div>
  );
}

/**
 * Android may pause apps in the background to save battery. Downloads with
 * the screen off need the app to be exempt: ask, explained in plain words.
 */
function BatteryHint() {
  const t = useT();
  const [restricted, setRestricted] = useState(false);
  useEffect(() => {
    const check = () =>
      void AskeNative.batteryStatus()
        .then((s) => setRestricted(!s.unrestricted))
        .catch(() => setRestricted(false));
    check();
    const onVisible = () => document.visibilityState === 'visible' && check();
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);
  if (!restricted) return null;
  return (
    <div className="banner dl-battery">
      <BatteryWarning size={20} />
      <div className="grow small">{t('dl.batteryText')}</div>
      <button
        className="btn small primary"
        onClick={() => void AskeNative.requestBatteryExemption()}
      >
        {t('dl.batteryButton')}
      </button>
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
      {home === 'cloudflare' ? (
        <>
          <div>{t('dl.whereCloud')}</div>
          <label className="row" style={{ marginTop: 8 }}>
            <input
              type="checkbox"
              checked={keepOffline}
              onChange={(e) => useDownloads.getState().setKeepOffline(e.target.checked)}
            />
            {t('dl.keepOffline')}
          </label>
        </>
      ) : (
        <div>{t('dl.whereDevice')}</div>
      )}
    </div>
  );
}

function EnginePanel() {
  const t = useT();
  const engine = useDownloads((s) => s.engine);
  const busy = engine.status === 'starting' || engine.status === 'updating';
  return (
    <div className="panel dl-engine small">
      <div className="grow">
        <div>
          {t('dl.engine')}
          {engine.version ? ` · ${engine.version}` : ''}
        </div>
        <div className="faint">
          {engine.status === 'error' ? t('dl.engineError') : t('dl.engineHint')}
        </div>
      </div>
      <button
        className="btn small"
        disabled={busy}
        onClick={() => void useDownloads.getState().updateEngine(true)}
      >
        {busy ? <LoaderCircle size={16} className="spin" /> : <RefreshCw size={16} />}
        {engine.status === 'updating' ? t('dl.engineUpdating') : t('dl.engineUpdate')}
      </button>
    </div>
  );
}

/* ----------------------------- computer outbox ----------------------------- */

function sendStatus(t: ReturnType<typeof useT>, item: SendItem): string {
  if (item.status === 'pending') return t('send.st.pending');
  if (item.status === 'taken') return t('send.st.taken');
  if (item.status === 'done') return item.detail || t('send.st.done');
  return item.detail || t('send.st.error');
}

function Outbox() {
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
              {item.thumbnail ? (
                <img
                  className="dl-thumb"
                  src={item.thumbnail}
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="dl-thumb station-logo">
                  {item.kind === 'playlist' ? <ListMusic size={20} /> : <Download size={20} />}
                </div>
              )}
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
