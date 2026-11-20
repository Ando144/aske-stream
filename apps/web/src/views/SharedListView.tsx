import { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ChevronLeft, LoaderCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import type { SharedList } from '@aske/shared/hub';
import { songCount, useI18n, useT } from '../i18n';
import { getSharedList } from '../hub/client';
import { hubErrorText } from '../hub/errors';
import { splitByLibrary } from '../hub/sharedList';
import { isNative } from '../native/platform';
import { useDownloads } from '../stores/downloads';
import { useLibrary } from '../stores/library';
import { toast } from '../stores/ui';

type Loaded = { list: SharedList } | { error: string } | null;

function useSharedList(id: string): Loaded {
  const [loaded, setLoaded] = useState<{ id: string; value: Loaded } | null>(null);
  useEffect(() => {
    let cancelled = false;
    getSharedList(id)
      .then((list) => !cancelled && setLoaded({ id, value: { list } }))
      .catch((err) => !cancelled && setLoaded({ id, value: { error: hubErrorText(err) } }));
    return () => {
      cancelled = true;
    };
  }, [id]);
  return loaded?.id === id ? loaded.value : null;
}

function DownloadAction({ list, missingCount }: { list: SharedList; missingCount: number }) {
  const t = useT();
  const [busy, setBusy] = useState(false);

  if (!isNative) return <p className="muted small">{t('shared.webOnly')}</p>;

  const download = async () => {
    setBusy(true);
    try {
      // Songs already in the library are skipped by the queue, but still land in the playlist.
      await useDownloads.getState().enqueue(
        list.songs.map((s) => ({ videoId: s.videoId, title: s.title, author: s.artist })),
        { playlistName: list.name },
      );
      if (missingCount === 0) toast(t('shared.nothingToDownload'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="btn primary" disabled={busy} onClick={() => void download()}>
      {busy ? <LoaderCircle size={16} className="spin" /> : <ArrowDownToLine size={16} />}
      {t('shared.download')}
    </button>
  );
}

function ListDetails({ list, readOnly }: { list: SharedList; readOnly: boolean }) {
  const t = useT();
  const language = useI18n((s) => s.language);
  const tracks = useLibrary((s) => s.tracks);
  const split = useMemo(() => splitByLibrary(list.songs, tracks), [list.songs, tracks]);
  return (
    <>
      <div className="muted small">{t('shared.title')}</div>
      <header className="page-header">
        <h1>{list.name}</h1>
      </header>
      <div className="muted small">{songCount(t, list.songs.length)}</div>
      {!readOnly && split.have.length > 0 && (
        <div className="muted small">{t('shared.have', { count: split.have.length })}</div>
      )}
      <div className="faint small">
        {t('shared.expires', { date: new Date(list.expiresAt).toLocaleDateString(language) })}
      </div>
      <ul className="small" style={{ margin: '12px 0' }}>
        {list.songs.map((song) => (
          <li key={song.videoId}>
            {song.title}
            {song.artist ? <span className="muted"> · {song.artist}</span> : null}
          </li>
        ))}
      </ul>
    </>
  );
}

/** A playlist someone shared with a link. `readOnly` is used before the app is set up. */
export function SharedListView({
  id,
  onStart,
}: {
  id: string;
  /** Set before the app is configured: shows «Start using Aske Stream» instead of downloads. */
  onStart?: () => void;
}) {
  const t = useT();
  const [, navigate] = useLocation();
  const loaded = useSharedList(id);
  const readOnly = onStart !== undefined;
  const tracks = useLibrary((s) => s.tracks);

  return (
    <div className="page">
      {!readOnly && (
        <button
          className="icon-btn"
          onClick={() => navigate('/playlists')}
          aria-label={t('shared.back')}
        >
          <ChevronLeft size={24} />
        </button>
      )}
      {loaded === null && (
        <p className="muted">
          <LoaderCircle size={16} className="spin" /> {t('shared.loading')}
        </p>
      )}
      {loaded && 'error' in loaded && <p className="error-text">{loaded.error}</p>}
      {loaded && 'list' in loaded && (
        <>
          <ListDetails list={loaded.list} readOnly={readOnly} />
          <div className="shared-list-actions">
            {readOnly ? (
              <button className="btn primary" onClick={onStart}>
                {t('shared.start')}
              </button>
            ) : (
              <DownloadAction
                list={loaded.list}
                missingCount={splitByLibrary(loaded.list.songs, tracks).missing.length}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
