import { useRef, useState, type MutableRefObject, type ReactNode } from 'react';
import { Download, ListMusic, LoaderCircle, Plus, Search, Send } from 'lucide-react';
import {
  classifyPlaylistLink,
  isYoutubeUrl,
  youtubePlaylistId,
  youtubeVideoId,
  type SearchKind,
  type SearchPage,
  type SearchResult,
} from '@aske/shared/youtube';
import { api } from '../../api/client';
import { withNextPage, type PagedResults } from '../../downloads/searchPages';
import { searchViaHub } from '../../hub/client';
import { useI18n, useT, type Language } from '../../i18n';
import { searchOnPhone } from '../../native/downloader';
import { isNative } from '../../native/platform';
import { useDownloads } from '../../stores/downloads';
import { useParcel } from '../../stores/parcel';
import { useSend } from '../../stores/send';
import { toast } from '../../stores/ui';
import { PlaylistPicker } from './PlaylistPicker';
import { SearchResultRow, type SendVia } from './SearchResultRow';

const KINDS: SearchKind[] = ['songs', 'videos', 'playlists'];
const HUB_KINDS: SearchKind[] = ['songs', 'videos'];

interface SearchTerms {
  q: string;
  kind: SearchKind;
  language: Language;
}

/** The search that produced the results, so "load more" ignores what is typed afterwards. */
type Found = SearchTerms & PagedResults;

async function searchFor(
  via: SendVia,
  { q, kind, language }: SearchTerms,
  continuation?: string,
): Promise<SearchPage> {
  if (isNative) return searchOnPhone(q, kind, language, continuation);
  if (via === 'hub') {
    return searchViaHub(q, kind === 'videos' ? 'videos' : 'songs', language, continuation);
  }
  const page = await api.youtubeSearch(q, kind, language, continuation);
  // Workers that have not been updated yet send no token.
  return { results: page.results, continuation: page.continuation ?? null };
}

/** Loads the following pages. `searchSeq` changes whenever another search replaces this one. */
function useLoadMore(
  via: SendVia,
  searchSeq: MutableRefObject<number>,
  found: Found | null,
  setFound: (found: Found) => void,
) {
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const reset = () => {
    setLoading(false);
    setFailed(false);
  };

  const load = async () => {
    if (!found?.continuation) return;
    const seq = searchSeq.current;
    setLoading(true);
    setFailed(false);
    try {
      const page = await searchFor(via, found, found.continuation);
      if (seq === searchSeq.current) setFound(withNextPage(found, page));
    } catch (err) {
      if (seq !== searchSeq.current) return;
      console.warn(err);
      setFailed(true);
    } finally {
      if (seq === searchSeq.current) setLoading(false);
    }
  };

  return { loading, failed, load, reset };
}

function useSearch(via: SendVia) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const [found, setFound] = useState<Found | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchSeq = useRef(0);
  const more = useLoadMore(via, searchSeq, found, setFound);

  const run = async (q: string, kind: SearchKind) => {
    const seq = ++searchSeq.current;
    more.reset();
    setBusy(true);
    setError(null);
    try {
      const terms = { q, kind, language };
      const page = await searchFor(via, terms);
      if (seq === searchSeq.current) setFound({ ...terms, ...page, ended: false });
    } catch (err) {
      if (seq !== searchSeq.current) return;
      console.warn(err);
      setFound(null);
      setError(navigator.onLine ? t('dl.searchFailed') : t('toast.offline'));
    } finally {
      if (seq === searchSeq.current) setBusy(false);
    }
  };

  const clear = () => {
    // Invalidate any in-flight search so a late answer cannot repaint results.
    searchSeq.current++;
    more.reset();
    setFound(null);
    setError(null);
    setBusy(false);
  };

  return { found, busy, error, more, run, clear };
}

function KindPicker({
  via,
  kind,
  onPick,
}: {
  via: SendVia;
  kind: SearchKind;
  onPick: (kind: SearchKind) => void;
}) {
  const t = useT();
  return (
    <div className="segmented dl-kinds" role="radiogroup" aria-label={t('dl.searchPlaceholder')}>
      {(via === 'hub' ? HUB_KINDS : KINDS).map((k) => (
        <button
          key={k}
          role="radio"
          aria-checked={kind === k}
          className={kind === k ? 'active' : ''}
          onClick={() => onPick(k)}
        >
          {t(`dl.kind.${k}`)}
        </button>
      ))}
    </div>
  );
}

/** End of the list: the "load more" button, or a note when there is nothing else. */
function LoadMore({
  found,
  loading,
  failed,
  onLoad,
}: {
  found: Found;
  loading: boolean;
  failed: boolean;
  onLoad: () => void;
}) {
  const t = useT();
  if (found.results.length === 0) return null;
  if (found.ended) return <p className="muted small">{t('dl.noMore')}</p>;
  if (!found.continuation) return null;
  return (
    <>
      {failed && (
        <div className="error-text small" role="alert">
          {t('dl.loadMoreFailed')}
        </div>
      )}
      <button
        className="btn small dl-more"
        style={{ alignSelf: 'center' }}
        disabled={loading}
        onClick={onLoad}
      >
        {loading && <LoaderCircle className="spin" size={16} />}
        {loading ? t('dl.loadingMore') : t('dl.loadMore')}
      </button>
    </>
  );
}

function SearchResults({
  found,
  via,
  more,
  onOpen,
}: {
  found: Found;
  via: SendVia;
  more: ReturnType<typeof useLoadMore>;
  onOpen: (result: SearchResult) => void;
}) {
  const t = useT();
  return (
    <>
      {found.results.length === 0 && <p className="muted">{t('dl.noResults')}</p>}
      <div className="card-list">
        {found.results.map((r) => (
          <SearchResultRow key={r.kind + r.id} result={r} via={via} onOpen={() => onOpen(r)} />
        ))}
      </div>
      <LoadMore
        found={found}
        loading={more.loading}
        failed={more.failed}
        onLoad={() => void more.load()}
      />
    </>
  );
}

/** Search box on top, its results right below, then `children` (the download queue). */
export function SearchPanel({ via, children }: { via: SendVia; children: ReactNode }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('songs');
  const [openPlaylist, setOpenPlaylist] = useState<SearchResult | null>(null);
  const { found, busy, error, more, run, clear } = useSearch(via);

  const link = isYoutubeUrl(query.trim()) ? query.trim() : null;

  const search = (k = kind) => {
    const q = query.trim();
    if (q && !link) void run(q, k);
  };

  const handleChange = (value: string) => {
    setQuery(value);
    if (value.trim() !== '') return;
    setOpenPlaylist(null);
    clear();
  };

  return (
    <section className="dl-search">
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          search();
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
        <KindPicker
          via={via}
          kind={kind}
          onPick={(k) => {
            setKind(k);
            search(k);
          }}
        />
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
      {found && !busy && (
        <SearchResults found={found} via={via} more={more} onOpen={setOpenPlaylist} />
      )}
      {children}
      {openPlaylist && (
        <PlaylistPicker result={openPlaylist} via={via} onClose={() => setOpenPlaylist(null)} />
      )}
    </section>
  );
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
