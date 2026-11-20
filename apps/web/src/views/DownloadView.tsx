import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Download,
  ListMusic,
  LoaderCircle,
  Search,
  Send,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { LIMITS, type SendItem } from '@aske/shared';
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
import { uniquePlaylistName } from '../downloads/batch';
import { loadValue, savePref } from '../lib/storage';
import { listPlaylistOnPhone, searchOnPhone, type PlaylistListing } from '../native/downloader';
import { isNative } from '../native/platform';
import { useDownloads } from '../stores/downloads';
import { useLibrary } from '../stores/library';
import { useSend } from '../stores/send';
import { useSetup } from '../stores/setup';
import { toast } from '../stores/ui';
import { HelpButton } from '../components/HelpSheet';
import { Queue } from '../components/downloads/DownloadQueue';
import { EnginePanel } from '../components/downloads/EnginePanel';

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
        <HelpButton id={isNative ? 'download-youtube' : 'send-to-phone'} />
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

      {link && <LinkCard url={link} onDone={() => setQuery('')} onOpenPlaylist={setOpenPlaylist} />}
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
        ['queued', 'downloading', 'downloaded', 'saving'].includes(j.status),
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
function LinkCard({
  url,
  onDone,
  onOpenPlaylist,
}: {
  url: string;
  onDone: () => void;
  onOpenPlaylist: (result: SearchResult) => void;
}) {
  const t = useT();
  const isPlaylist = !youtubeVideoId(url) && !!youtubePlaylistId(url);
  const [busy, setBusy] = useState(false);
  const valid = !!youtubeVideoId(url) || isPlaylist;

  const act = async () => {
    if (isNative && isPlaylist) {
      // Same preview as a searched playlist, so the "name already exists" question shows too.
      onOpenPlaylist({
        kind: 'playlist',
        id: youtubePlaylistId(url) ?? '',
        title: '',
        author: '',
        thumbnail: '',
        url,
      });
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

/** Cover of a playlist; falls back to an icon when the picture is missing or broken. */
function PlaylistCover({ src }: { src: string }) {
  const [broken, setBroken] = useState(!src);
  useEffect(() => setBroken(!src), [src]);
  if (broken) {
    return (
      <div className="dl-thumb dl-thumb-empty">
        <ListMusic size={22} />
      </div>
    );
  }
  return (
    <img
      className="dl-thumb"
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}

type SheetEntry = { id: string; title: string; author: string };

/** Preview of a playlist before downloading (phone) or sending it (computer). */
function PlaylistSheet({ result, onClose }: { result: SearchResult; onClose: () => void }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const [listing, setListing] = useState<PlaylistListing | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [title, setTitle] = useState(result.title);
  const [error, setError] = useState<string | null>(null);
  const [makePlaylist, setMakePlaylist] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'merge' | 'new'>('merge');
  const playlists = useLibrary((s) => s.playlists);
  const entries: SheetEntry[] | null = listing?.entries ?? null;
  const playlistName = title.slice(0, LIMITS.nameMax);
  const existingNames = playlists.map((p) => p.name);
  const nameTaken =
    !!playlistName &&
    existingNames.some((n) => n.trim().toLowerCase() === playlistName.trim().toLowerCase());

  useEffect(() => {
    if (!isNative) return;
    let alive = true;
    // YouTube's own API gave part of the list: show it while yt-dlp reads the rest.
    const onPartial = (partial: PlaylistListing) => {
      if (!alive) return;
      if (partial.title) setTitle(partial.title);
      setListing(partial);
      setLoadingMore(true);
    };
    listPlaylistOnPhone(result.url, language, onPartial)
      .then((l) => {
        if (!alive) return;
        if (l.title) setTitle(l.title);
        setListing(l);
        setLoadingMore(false);
        if (!l.entries.length) setError(t('dl.playlistEmpty'));
      })
      .catch((err: Error) => {
        if (!alive) return;
        setLoadingMore(false);
        setListing((prev) => prev ?? emptyListing());
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
        { playlistName: makePlaylist ? title : undefined, playlistMode: mode },
      );
    } else if (!isNative) {
      await useSend.getState().send(result);
    }
    setBusy(false);
    onClose();
  };

  const total = listing?.totalCount ?? null;
  const cover = result.thumbnail || (entries?.[0] ? videoThumb(entries[0].id) : '');
  // Rendered on <body> so it sits above the tab bar and the player, like the other sheets.
  return createPortal(
    <div className="backdrop" onClick={onClose}>
      <div className="sheet dl-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <div className="row">
          <PlaylistCover src={cover} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="card-title">{result.title || title}</div>
            <div className="muted small">
              {[result.author, result.count ? t('dl.songsCount', { count: result.count }) : null]
                .filter(Boolean)
                .join(' · ')}
            </div>
          </div>
        </div>
        {isNative && !listing && !error && (
          <div className="row muted dl-status">
            <LoaderCircle className="spin" size={18} /> {t('dl.loadingPlaylist')}
          </div>
        )}
        {loadingMore && entries && total && (
          <div className="row muted small dl-status">
            <LoaderCircle className="spin" size={16} />{' '}
            {t('dl.playlistLoadingMore', { count: entries.length, total })}
          </div>
        )}
        {error && <div className="error-text small">{error}</div>}
        {listing && !loadingMore && !listing.complete && entries && total && (
          <div className="muted small">
            {t('dl.playlistPartial', { count: entries.length, total })}
          </div>
        )}
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
        {isNative && makePlaylist && nameTaken && (
          <fieldset className="small" style={{ border: 'none', padding: 0, margin: 0 }}>
            <legend>{t('dl.playlistExists', { name: playlistName })}</legend>
            <label className="row">
              <input
                type="radio"
                name="playlist-mode"
                checked={mode === 'merge'}
                onChange={() => setMode('merge')}
              />
              {t('dl.playlistMerge')}
            </label>
            <label className="row">
              <input
                type="radio"
                name="playlist-mode"
                checked={mode === 'new'}
                onChange={() => setMode('new')}
              />
              {t('dl.playlistNew', {
                name: uniquePlaylistName(playlistName, existingNames, LIMITS.nameMax),
              })}
            </label>
          </fieldset>
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

const emptyListing = (): PlaylistListing => ({
  title: '',
  author: '',
  entries: [],
  totalCount: null,
  complete: true,
});

const videoThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

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
      ) : home === 'drive' ? (
        <>
          <div>{t('dl.whereDrive')}</div>
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
