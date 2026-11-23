import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, ListMusic, LoaderCircle, Send } from 'lucide-react';
import { LIMITS } from '@aske/shared';
import type { HubSong } from '@aske/shared/hub';
import type { SearchResult } from '@aske/shared/youtube';
import { useI18n, useT, type MessageKey } from '../../i18n';
import { uniquePlaylistName } from '../../downloads/batch';
import { pickedEntries } from '../../downloads/pickSelection';
import {
  addFreshSelection,
  pickerActionText,
  pickerNotices,
  pickerSubtitle,
} from '../../downloads/pickerView';
import type { PlaylistListing } from '../../downloads/playlistReader';
import { listPlaylist, PlaylistLinkError } from '../../downloads/playlistSource';
import { hubAvailable, HubError } from '../../hub/client';
import { isTimeout } from '../../lib/timeout';
import { isNative } from '../../native/platform';
import { useDownloads } from '../../stores/downloads';
import { useLibrary } from '../../stores/library';
import { parcelErrorText, useParcel } from '../../stores/parcel';
import { useSend } from '../../stores/send';
import { toast } from '../../stores/ui';
import { PickList } from './PickList';

type Via = 'cloudflare' | 'hub' | null;
type Mode = 'merge' | 'new';

const videoThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

const emptyListing = (): PlaylistListing => ({
  title: '',
  author: '',
  entries: [],
  totalCount: null,
  complete: true,
  unavailable: 0,
});

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

function errorMessage(err: unknown, t: (key: MessageKey) => string): string {
  if (err instanceof PlaylistLinkError) return t(`pick.err.${err.reason}` as MessageKey);
  if (isTimeout(err)) return t('dl.playlistSlow');
  if (err instanceof HubError) return parcelErrorText(err);
  const detail = err instanceof Error ? ` (${err.message})` : '';
  return `${t('dl.playlistFailed')}${detail}`;
}

interface Loaded {
  listing: PlaylistListing | null;
  loading: boolean;
  error: string | null;
}

/** Reads the playlist (with partial results) and keeps the selection in step with it. */
function usePlaylistListing(
  url: string,
  enabled: boolean,
  onEntries: (ids: string[]) => void,
): Loaded {
  const t = useT();
  const language = useI18n((s) => s.language);
  const [state, setState] = useState<Loaded>({ listing: null, loading: enabled, error: null });
  const onEntriesRef = useRef(onEntries);
  onEntriesRef.current = onEntries;

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const show = (listing: PlaylistListing, loading: boolean) => {
      if (!alive) return;
      setState({ listing, loading, error: null });
      onEntriesRef.current(listing.entries.map((e) => e.id));
    };
    listPlaylist(url, language, (partial) => show(partial, true))
      .then((listing) => show(listing, false))
      .catch((err: unknown) => {
        if (!alive) return;
        setState((prev) => ({
          listing: prev.listing ?? emptyListing(),
          loading: false,
          error: errorMessage(err, t),
        }));
      });
    return () => {
      alive = false;
    };
  }, [url, enabled]);

  return state;
}

function songsFrom(entries: PlaylistListing['entries']): HubSong[] {
  return entries.map((e) => ({
    videoId: e.id,
    title: e.title,
    artist: e.author,
    ...(e.duration > 0 ? { durationMs: e.duration * 1000 } : {}),
  }));
}

/** Newly read songs start ticked (up to the limit); the user's later changes are kept. */
function useSelection() {
  const seen = useRef(new Set<string>());
  const selectedRef = useRef<ReadonlySet<string>>(new Set());
  const [selected, setSelectedState] = useState<Set<string>>(new Set());
  const setSelected = (next: Set<string>) => {
    selectedRef.current = next;
    setSelectedState(next);
  };
  const onEntries = (ids: string[]) => {
    // Computed outside the updater so `seen` is not mutated twice by StrictMode.
    const next = addFreshSelection(
      selectedRef.current,
      seen.current,
      ids,
      LIMITS.playlistMaxTracks,
    );
    if (!next) return;
    setSelected(next);
  };
  return { selected, setSelected, onEntries };
}

interface SubmitInput {
  result: SearchResult;
  sendsLink: boolean;
  picked: PlaylistListing['entries'];
  playlistName: string;
  makePlaylist: boolean;
  mode: Mode;
  unavailable: number;
  onClose: () => void;
}

function usePickerSubmit(input: SubmitInput) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<boolean> => {
    const { result, sendsLink, picked, playlistName, makePlaylist, mode, unavailable } = input;
    if (sendsLink) return useSend.getState().send(result);
    if (isNative) {
      await useDownloads.getState().enqueue(
        picked.map((e) => ({ videoId: e.id, title: e.title, author: e.author })),
        { playlistName: makePlaylist ? playlistName : undefined, playlistMode: mode },
      );
      if (unavailable > 0) toast(t('pick.unavailableSummary', { count: unavailable }));
      return true;
    }
    return useParcel
      .getState()
      .sendPlaylist({ name: playlistName, songs: songsFrom(picked), unavailable });
  };

  const go = async () => {
    setBusy(true);
    try {
      if (await submit()) input.onClose();
    } finally {
      setBusy(false);
    }
  };
  return { busy, go };
}

function PickerHeader({
  cover,
  title,
  subtitle,
}: {
  cover: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="row">
      <PlaylistCover src={cover} />
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="card-title">{title}</div>
        <div className="muted small">{subtitle}</div>
      </div>
    </div>
  );
}

function PickerNotices({ listing, loading, error }: Loaded) {
  const t = useT();
  const count = listing?.entries.length ?? 0;
  const total = listing?.totalCount ?? 0;
  const unavailable = listing?.unavailable ?? 0;
  const { partial, overLimit } = pickerNotices(listing, loading, LIMITS.playlistMaxTracks);
  return (
    <>
      {loading && (
        <div className="row muted small dl-status">
          <LoaderCircle className="spin" size={16} />{' '}
          {total ? t('pick.loadingMore', { count, total }) : t('pick.loading')}
        </div>
      )}
      {error && <div className="error-text small">{error}</div>}
      {partial && <div className="muted small">{t('dl.playlistPartial', { count, total })}</div>}
      {overLimit && (
        <div className="muted small">
          {t('pick.overLimit', { total, count: LIMITS.playlistMaxTracks })}
        </div>
      )}
      {unavailable > 0 && (
        <div className="muted small">{t('pick.unavailableNote', { count: unavailable })}</div>
      )}
    </>
  );
}

/** Phone only: whether to also create a playlist, and what to do if the name already exists. */
function NameChoice({
  title,
  playlistName,
  makePlaylist,
  onMakePlaylist,
  mode,
  onMode,
}: {
  title: string;
  playlistName: string;
  makePlaylist: boolean;
  onMakePlaylist: (value: boolean) => void;
  mode: Mode;
  onMode: (value: Mode) => void;
}) {
  const t = useT();
  const playlists = useLibrary((s) => s.playlists);
  const existingNames = playlists.map((p) => p.name);
  const nameTaken =
    !!playlistName &&
    existingNames.some((n) => n.trim().toLowerCase() === playlistName.trim().toLowerCase());
  return (
    <>
      <label className="row small">
        <input
          type="checkbox"
          checked={makePlaylist}
          onChange={(e) => onMakePlaylist(e.target.checked)}
        />
        {t('dl.makePlaylist', { name: title })}
      </label>
      {makePlaylist && nameTaken && (
        <NameConflict
          playlistName={playlistName}
          existingNames={existingNames}
          mode={mode}
          onMode={onMode}
        />
      )}
    </>
  );
}

function NameConflict({
  playlistName,
  existingNames,
  mode,
  onMode,
}: {
  playlistName: string;
  existingNames: string[];
  mode: Mode;
  onMode: (value: Mode) => void;
}) {
  const t = useT();
  return (
    <fieldset className="small" style={{ border: 'none', padding: 0, margin: 0 }}>
      <legend>{t('dl.playlistExists', { name: playlistName })}</legend>
      <label className="row">
        <input
          type="radio"
          name="playlist-mode"
          checked={mode === 'merge'}
          onChange={() => onMode('merge')}
        />
        {t('dl.playlistMerge')}
      </label>
      <label className="row">
        <input
          type="radio"
          name="playlist-mode"
          checked={mode === 'new'}
          onChange={() => onMode('new')}
        />
        {t('dl.playlistNew', {
          name: uniquePlaylistName(playlistName, existingNames, LIMITS.nameMax),
        })}
      </label>
    </fieldset>
  );
}

function PickerFooter({
  label,
  disabled,
  onCancel,
  onGo,
}: {
  label: string;
  disabled: boolean;
  onCancel: () => void;
  onGo: () => void;
}) {
  const t = useT();
  return (
    <div className="row" style={{ justifyContent: 'flex-end' }}>
      <button className="btn small" onClick={onCancel}>
        {t('common.cancel')}
      </button>
      <button className="btn primary small" disabled={disabled} onClick={onGo}>
        {isNative ? <Download size={16} /> : <Send size={16} />}
        {label}
      </button>
    </div>
  );
}

interface PickerProps {
  result: SearchResult;
  via: Via;
  onClose: () => void;
}

/** Everything the sheet shows and does: selection, name choice, reading and submitting. */
function usePickerState({ result, via, onClose }: PickerProps) {
  const t = useT();
  const sendsLink = !isNative && via === 'cloudflare' && !hubAvailable();
  const { selected, setSelected, onEntries } = useSelection();
  const [makePlaylist, setMakePlaylist] = useState(true);
  const [mode, setMode] = useState<Mode>('merge');
  const loaded = usePlaylistListing(result.url, !sendsLink, onEntries);
  const { listing } = loaded;

  const entries = listing?.entries ?? [];
  const title = listing?.title || result.title;
  const playlistName = title.slice(0, LIMITS.nameMax);
  const picked = pickedEntries(entries, selected);
  const cover = result.thumbnail || (entries[0] ? videoThumb(entries[0].id) : '');
  const subtitle = pickerSubtitle(result.author || listing?.author, listing?.totalCount ?? null, t);
  const { busy, go } = usePickerSubmit({
    result,
    sendsLink,
    picked,
    playlistName,
    makePlaylist,
    mode,
    unavailable: listing?.unavailable ?? 0,
    onClose,
  });
  const label = pickerActionText(t, sendsLink, picked.length, isNative);
  const disabled = busy || (!sendsLink && picked.length === 0);
  return {
    loaded,
    entries,
    title,
    playlistName,
    cover,
    subtitle,
    label,
    disabled,
    go,
    sendsLink,
    selected,
    setSelected,
    makePlaylist,
    setMakePlaylist,
    mode,
    setMode,
  };
}

type PickerState = ReturnType<typeof usePickerState>;

function PickerSheet({ s, onClose }: { s: PickerState; onClose: () => void }) {
  const t = useT();
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="sheet dl-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal>
        <PickerHeader cover={s.cover} title={s.title} subtitle={s.subtitle} />
        <PickerNotices {...s.loaded} />
        {s.entries.length > 0 && (
          <PickList entries={s.entries} selected={s.selected} onChange={s.setSelected} />
        )}
        {isNative && (
          <NameChoice
            title={s.title}
            playlistName={s.playlistName}
            makePlaylist={s.makePlaylist}
            onMakePlaylist={s.setMakePlaylist}
            mode={s.mode}
            onMode={s.setMode}
          />
        )}
        {s.sendsLink && <p className="small muted">{t('send.playlistHint')}</p>}
        <PickerFooter
          label={s.label}
          disabled={s.disabled}
          onCancel={onClose}
          onGo={() => void s.go()}
        />
      </div>
    </div>
  );
}

/** Preview of a playlist: pick songs, then download them (phone) or send them (computer). */
export function PlaylistPicker(props: PickerProps) {
  const state = usePickerState(props);
  // Rendered on <body> so it sits above the tab bar and the player, like the other sheets.
  return createPortal(<PickerSheet s={state} onClose={props.onClose} />, document.body);
}
