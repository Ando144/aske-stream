import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CircleCheck, Library, Play, Search, Shuffle, Timer } from 'lucide-react';
import { Link, useSearch } from 'wouter';
import { isNative } from '../native/platform';
import { songCount, useT } from '../i18n';
import { formatBytes, formatLongDuration, normalizeText } from '../lib/format';
import { loadValue, savePref } from '../lib/storage';
import { useAllTracks, useLibrary } from '../stores/library';
import { useOffline } from '../stores/offline';
import { usePlayer } from '../stores/player';
import { useUi } from '../stores/ui';
import { ImportButton } from '../components/ImportButton';
import { TrackList } from '../components/TrackList';
import { useSetup } from '../stores/setup';
import { SettingsLink } from '../components/SettingsLink';
import { ScreenTip } from '../components/ScreenTip';
import { FirstSteps } from '../components/FirstSteps';
import { CopyPanel } from '../components/CopyPanel';

type Filter = 'all' | 'liked' | 'downloaded';
type Sort = 'recent' | 'title' | 'artist';

export function LibraryView() {
  const t = useT();
  const all = useAllTracks();
  const loaded = useLibrary((s) => s.loaded);
  const error = useLibrary((s) => s.error);
  const entries = useOffline((s) => s.entries);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>(() => loadValue<Sort>('library-sort', 'recent'));
  const deferredQuery = useDeferredValue(query);
  const home = useSetup((s) => s.config?.home);
  const selecting = useUi((s) => s.selection !== null);
  const shuffling = usePlayer(
    (s) => s.mode === 'track' && s.shuffle && s.contextInfo?.path === '/',
  );
  const target = useUi((s) => s.selectionTarget);
  const playlists = useLibrary((s) => s.playlists);
  const search = useSearch();

  // "Add songs" from a playlist opens the library in picking mode: ?addTo=<playlistId>
  useEffect(() => {
    const addTo = new URLSearchParams(search).get('addTo');
    const pl = addTo ? playlists.find((p) => p.id === addTo) : undefined;
    if (pl) useUi.getState().startSelection(undefined, { playlistId: pl.id, name: pl.name });
  }, [search, playlists]);

  // The "send songs" sheet opens the library in plain picking mode: ?select=1
  useEffect(() => {
    if (new URLSearchParams(search).get('select') === '1') useUi.getState().startSelection();
  }, [search]);

  const tracks = useMemo(() => {
    const q = normalizeText(deferredQuery.trim());
    let list = all.filter((tr) => tr.kind !== 'podcast');
    if (filter === 'liked') list = list.filter((tr) => tr.likedAt !== null);
    if (filter === 'downloaded') list = list.filter((tr) => entries[tr.id]);
    if (q) {
      list = list.filter((tr) => normalizeText(`${tr.title} ${tr.artist} ${tr.album}`).includes(q));
    }
    if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    if (sort === 'artist') {
      list = [...list].sort(
        (a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title),
      );
    }
    return list;
  }, [all, filter, entries, deferredQuery, sort]);

  const totalMs = useMemo(() => tracks.reduce((sum, tr) => sum + tr.durationMs, 0), [tracks]);
  const totalBytes = useMemo(
    () => tracks.reduce((sum, tr) => sum + (tr.sizeBytes || 0), 0),
    [tracks],
  );
  const ids = useMemo(() => tracks.map((tr) => tr.id), [tracks]);
  const normalizedQuery = normalizeText(deferredQuery.trim());
  const context = {
    label: t('nav.library'),
    path: '/',
    ...(filter === 'all' && !normalizedQuery ? { live: 'library' as const } : {}),
    cycleKey: `library:${filter}:${normalizedQuery}`,
  };
  const play = (startId: string | null, shuffle?: boolean) =>
    usePlayer.getState().playTracks(ids, startId, { shuffle, context });

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('library.title')}</h1>
        <div className="row">
          {isNative && (
            <Link href="/study" className="btn small">
              <Timer size={16} /> {t('nav.study')}
            </Link>
          )}
          {(home === 'device' || home === 'drive') && <ImportButton />}
          <SettingsLink />
        </div>
      </header>
      <ScreenTip id="library" text="tips.library" helpId="queue" />

      {target && <div className="banner accent">{t('select.pickHint', { name: target.name })}</div>}

      {loaded && <FirstSteps />}
      <CopyPanel compact />
      {loaded && all.length === 0 ? (
        <div className="empty">
          <Library size={40} />
          <h2>{t('library.empty')}</h2>
          {home === 'device' ? (
            <p className="small">{t('library.emptyDevice')}</p>
          ) : home === 'drive' ? (
            <p className="small">{t('library.emptyDrive')}</p>
          ) : (
            <p className="small">{t('library.emptyHint')}</p>
          )}
          {error && <p className="error-text">{error}</p>}
        </div>
      ) : (
        <>
          <div className="search">
            <Search size={18} />
            <input
              className="input"
              type="search"
              value={query}
              placeholder={t('library.search')}
              aria-label={t('library.search')}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="chips" style={{ margin: '12px 0 4px' }}>
            {(['all', 'liked', 'downloaded'] as const).map((f) => (
              <button
                key={f}
                className={`chip${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
              >
                {t(
                  f === 'all'
                    ? 'library.filterAll'
                    : f === 'liked'
                      ? 'library.filterLiked'
                      : 'library.filterDownloaded',
                )}
              </button>
            ))}
          </div>

          <div className="collection-actions">
            <button
              className="play-fab"
              onClick={() => play(null, false)}
              disabled={!ids.length}
              aria-label={t('common.play')}
            >
              <Play size={24} fill="currentColor" style={{ marginLeft: 2 }} />
            </button>
            <button
              className={`btn${shuffling ? ' on' : ''}`}
              onClick={() => play(null, true)}
              disabled={!ids.length}
              aria-pressed={shuffling}
            >
              <Shuffle size={18} /> {t('common.shuffle')}
            </button>
            <button
              className={`btn small${selecting ? ' on' : ''}`}
              onClick={() =>
                selecting ? useUi.getState().endSelection() : useUi.getState().startSelection()
              }
              aria-pressed={selecting}
              disabled={!ids.length}
            >
              <CircleCheck size={18} /> {t('select.start')}
            </button>
            <span className="grow" />
            <select
              className="select compact"
              value={sort}
              aria-label="sort"
              onChange={(e) => {
                const value = e.target.value as Sort;
                setSort(value);
                savePref('library-sort', value);
              }}
            >
              <option value="recent">{t('library.sortRecent')}</option>
              <option value="title">{t('library.sortTitle')}</option>
              <option value="artist">{t('library.sortArtist')}</option>
            </select>
          </div>
          <p className="muted small" style={{ margin: '0 0 6px' }}>
            {songCount(t, tracks.length)} · {formatLongDuration(totalMs)} ·{' '}
            {formatBytes(totalBytes)}
          </p>

          {tracks.length === 0 ? (
            <p className="empty">{t('library.noResults')}</p>
          ) : (
            <TrackList tracks={tracks} onPlay={(id) => play(id)} />
          )}
        </>
      )}
    </div>
  );
}
