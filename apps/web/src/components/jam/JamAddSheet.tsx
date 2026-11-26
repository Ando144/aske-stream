import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { LoaderCircle, Plus } from 'lucide-react';
import type { HubSong } from '@aske/shared/hub';
import type { SearchResult } from '@aske/shared/youtube';
import { useI18n, useT } from '../../i18n';
import { searchInJam } from '../../hub/client';
import { hubErrorText } from '../../hub/errors';
import { filterLibrarySongs, toHubSong } from '../../hub/jamFromLibrary';
import { useJam } from '../../stores/jam';
import { useLibrary } from '../../stores/library';
import { toast } from '../../stores/ui';
import { Cover } from '../Cover';
import { Sheet } from '../Sheet';
import { SongThumb } from '../SongThumb';
import '../../jamPick.css';

const SEARCH_DELAY_MS = 400;
const MIN_YOUTUBE_QUERY = 2;
const MAX_LIBRARY_SONGS = 200;

type Found = { results: SearchResult[] } | { error: string } | null;
type AddSong = (song: HubSong) => void;

/** Debounced search through the Hub; `null` while loading or when the query is too short. */
function useJamSearch(code: string, query: string): { found: Found; loading: boolean } {
  const language = useI18n((s) => s.language);
  const [state, setState] = useState<{ query: string; found: Found } | null>(null);
  const trimmed = query.trim();
  const active = trimmed.length >= MIN_YOUTUBE_QUERY;

  useEffect(() => {
    if (!active) return;
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
  }, [code, trimmed, language, active]);

  const current = active && state?.query === trimmed ? state.found : null;
  return { found: current, loading: active && current === null };
}

function SongRow({ song, art, onAdd }: { song: HubSong; art: ReactNode; onAdd: AddSong }) {
  const t = useT();
  return (
    <li className="jam-item jam-pick-item">
      {art}
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

function LibraryResults({ query, onAdd }: { query: string; onAdd: AddSong }) {
  const t = useT();
  const tracks = useLibrary((s) => s.tracks);
  const matches = useMemo(
    () => filterLibrarySongs(Object.values(tracks), query, MAX_LIBRARY_SONGS),
    [tracks, query],
  );
  const empty = query.trim() ? t('jam.search.empty') : t('jam.library.empty');
  return (
    <section className="jam-pick-section">
      <h3>{t('jam.add.fromLibrary')}</h3>
      {matches.length === 0 && <p className="muted small">{empty}</p>}
      <ul className="jam-list">
        {matches.map((track) => (
          <SongRow
            key={track.id}
            song={toHubSong(track)!}
            art={<Cover trackId={track.id} hasCover={track.hasCover} />}
            onAdd={onAdd}
          />
        ))}
      </ul>
    </section>
  );
}

function toSongs(results: SearchResult[]): HubSong[] {
  return results
    .filter((r) => r.kind === 'video')
    .map((r) => ({
      videoId: r.id,
      title: r.title,
      artist: r.author,
      durationMs: r.duration ? r.duration * 1000 : undefined,
    }));
}

function YoutubeResults({ code, query, onAdd }: { code: string; query: string; onAdd: AddSong }) {
  const t = useT();
  const { found, loading } = useJamSearch(code, query);
  if (query.trim().length < MIN_YOUTUBE_QUERY) {
    return <p className="muted small">{t('jam.add.typeMore')}</p>;
  }
  const songs = found && 'results' in found ? toSongs(found.results) : [];
  return (
    <section className="jam-pick-section">
      <h3>{t('jam.add.fromYoutube')}</h3>
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
          <SongRow
            key={song.videoId}
            song={song}
            art={<SongThumb videoId={song.videoId} />}
            onAdd={onAdd}
          />
        ))}
      </ul>
    </section>
  );
}

/** One search box over the user's library and, through the Hub, YouTube. */
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
  const [query, setQuery] = useState('');
  const add: AddSong = (song) => {
    useJam.getState().add(song);
    toast(t('jam.add.done'));
  };
  return (
    <Sheet onClose={onClose} label={t('jam.add.title')}>
      <div className="sheet-header">
        <div className="track-title grow">{t('jam.add.title')}</div>
      </div>
      <div className="sheet-body jam-pick">
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('jam.add.placeholder')}
          aria-label={t('jam.add.placeholder')}
          autoFocus
        />
        {hasLibrary && <LibraryResults query={query} onAdd={add} />}
        <YoutubeResults code={code} query={query} onAdd={add} />
      </div>
    </Sheet>
  );
}
