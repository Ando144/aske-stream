import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle, Plus } from 'lucide-react';
import type { HubSong } from '@aske/shared/hub';
import type { SearchResult } from '@aske/shared/youtube';
import { useI18n, useT } from '../../i18n';
import { searchInJam } from '../../hub/client';
import { hubErrorText } from '../../hub/errors';
import { useJam } from '../../stores/jam';
import { useLibrary } from '../../stores/library';
import { toast } from '../../stores/ui';
import { Sheet } from '../Sheet';

const SEARCH_DELAY_MS = 400;

type Found = { results: SearchResult[] } | { error: string } | null;

/** Debounced search through the Hub; `null` while loading or when the query is empty. */
function useJamSearch(code: string, query: string): { found: Found; loading: boolean } {
  const language = useI18n((s) => s.language);
  const [state, setState] = useState<{ query: string; found: Found } | null>(null);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      searchInJam(code, trimmed, language)
        .then((results) => !cancelled && setState({ query: trimmed, found: { results } }))
        .catch(
          (e) => !cancelled && setState({ query: trimmed, found: { error: hubErrorText(e) } }),
        );
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, trimmed, language]);

  const current = trimmed && state?.query === trimmed ? state.found : null;
  return { found: current, loading: trimmed !== '' && current === null };
}

function SongRow({ song, onAdd }: { song: HubSong; onAdd: (song: HubSong) => void }) {
  const t = useT();
  return (
    <li className="jam-item">
      <div className="grow">
        <div className="card-title ellipsis">{song.title}</div>
        <div className="muted small ellipsis">{song.artist}</div>
      </div>
      <button
        className="icon-btn"
        onClick={() => onAdd(song)}
        aria-label={t('jam.add')}
        title={t('jam.add')}
      >
        <Plus size={18} />
      </button>
    </li>
  );
}

function SearchTab({ code, onAdd }: { code: string; onAdd: (song: HubSong) => void }) {
  const t = useT();
  const [query, setQuery] = useState('');
  const { found, loading } = useJamSearch(code, query);
  const songs: HubSong[] =
    found && 'results' in found
      ? found.results
          .filter((r) => r.kind === 'video')
          .map((r) => ({
            videoId: r.id,
            title: r.title,
            artist: r.author,
            durationMs: r.duration ? r.duration * 1000 : undefined,
          }))
      : [];
  return (
    <div className="sheet-body">
      <input
        className="input"
        style={{ alignSelf: 'stretch' }}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('jam.search.placeholder')}
        aria-label={t('jam.search.placeholder')}
        autoFocus
      />
      {loading && (
        <p className="muted small">
          <LoaderCircle size={14} className="spin" /> {t('jam.search.loading')}
        </p>
      )}
      {found && 'error' in found && <div className="error-text">{found.error}</div>}
      {found && 'results' in found && songs.length === 0 && (
        <p className="muted small">{t('jam.search.empty')}</p>
      )}
      <ul className="jam-list">
        {songs.map((song) => (
          <SongRow key={song.videoId} song={song} onAdd={onAdd} />
        ))}
      </ul>
    </div>
  );
}

function LibraryTab({ onAdd }: { onAdd: (song: HubSong) => void }) {
  const t = useT();
  const tracks = useLibrary((s) => s.tracks);
  const songs = useMemo<HubSong[]>(
    () =>
      Object.values(tracks)
        .filter((tr) => tr.source === 'youtube' && tr.sourceRef)
        .map((tr) => ({
          videoId: tr.sourceRef as string,
          title: tr.title,
          artist: tr.artist,
          durationMs: tr.durationMs || undefined,
        })),
    [tracks],
  );
  if (songs.length === 0) return <p className="muted small sheet-body">{t('jam.library.empty')}</p>;
  return (
    <ul className="jam-list sheet-body">
      {songs.map((song) => (
        <SongRow key={song.videoId} song={song} onAdd={onAdd} />
      ))}
    </ul>
  );
}

/** Two tabs: search YouTube through the Hub, or pick from the user's own library. */
export function JamAddSheet({
  code,
  hasLibrary,
  onClose,
}: {
  code: string;
  hasLibrary: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const [tab, setTab] = useState<'search' | 'library'>('search');
  const add = (song: HubSong) => {
    useJam.getState().add(song);
    toast(t('jam.add.done'));
  };
  return (
    <Sheet onClose={onClose} label={t('jam.add.title')}>
      <div className="sheet-header">
        <div className="track-title grow">{t('jam.add.title')}</div>
      </div>
      {hasLibrary && (
        <div className="row wrap" style={{ padding: '0 12px' }}>
          <button
            className={`chip${tab === 'search' ? ' active' : ''}`}
            onClick={() => setTab('search')}
          >
            {t('jam.tab.search')}
          </button>
          <button
            className={`chip${tab === 'library' ? ' active' : ''}`}
            onClick={() => setTab('library')}
          >
            {t('jam.tab.library')}
          </button>
        </div>
      )}
      {tab === 'search' || !hasLibrary ? (
        <SearchTab code={code} onAdd={add} />
      ) : (
        <LibraryTab onAdd={add} />
      )}
    </Sheet>
  );
}
