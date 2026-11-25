import { useEffect, useRef, useState } from 'react';
import {
  Circle,
  CircleCheck,
  EllipsisVertical,
  Folder as FolderIcon,
  FolderPlus,
  Heart,
  Plus,
  ScanLine,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import type { Folder, Playlist } from '@aske/shared';
import { parseHubLink } from '@aske/shared/hub';
import { isNative } from '../native/platform';
import { scanQr } from '../native/qrScanner';
import { Sheet } from '../components/Sheet';
import { songCount, useT, type Translate } from '../i18n';
import { groupPlaylists } from '../storage/playlistOps';
import { useAllTracks, useLibrary } from '../stores/library';
import { promptDialog, useUi } from '../stores/ui';
import '../playlistSelect.css';
import { FriendsRow } from '../components/playlists/FriendsRow';
import { FolderMenu } from '../components/FolderMenu';
import { DraggablePlaylist, PlaylistDnd, SortableFolder } from '../components/PlaylistDnd';
import { PlaylistArt } from '../components/PlaylistArt';
import { PlaylistMenu } from '../components/PlaylistMenu';
import { SettingsLink } from '../components/SettingsLink';
import { ScreenTip } from '../components/ScreenTip';

export function PlaylistsView() {
  const t = useT();
  const [openLink, setOpenLink] = useState(false);
  const playlists = useLibrary((s) => s.playlists);
  const folders = useLibrary((s) => s.folders);
  const liked = useAllTracks().filter((tr) => tr.likedAt !== null).length;
  const groups = groupPlaylists(playlists, folders);

  const looseKey = groups.loose.map((p) => p.id).join(',');
  useEffect(() => {
    useUi.getState().setPlaylistVisibleIds(looseKey ? looseKey.split(',') : []);
  }, [looseKey]);

  const create = async () => {
    const name = await promptDialog({
      title: t('playlists.new'),
      placeholder: t('playlists.namePlaceholder'),
      initial: '',
      confirmLabel: t('common.create'),
    });
    if (name) await useLibrary.getState().createPlaylist(name);
  };

  const createFolder = async () => {
    const name = await promptDialog({
      title: t('folders.new'),
      placeholder: t('folders.namePlaceholder'),
      initial: '',
      confirmLabel: t('common.create'),
    });
    if (name) await useLibrary.getState().createFolder(name);
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t('playlists.title')}</h1>
        <div className="header-actions">
          <button
            className="btn small"
            onClick={() => void createFolder()}
            aria-label={t('folders.new')}
            title={t('folders.new')}
          >
            <FolderPlus size={16} />
          </button>
          <button
            className="btn primary small"
            onClick={() => void create()}
            aria-label={t('playlists.new')}
            title={t('playlists.new')}
          >
            <Plus size={16} />
          </button>
          <SettingsLink />
        </div>
      </header>
      <ScreenTip id="playlists" text="tips.playlists" helpId="playlists" />
      <FriendsRow onReceive={() => setOpenLink(true)} />
      <ScreenTip id="playlists-friends" text="share.tipFriends" helpId="share-playlist" />
      {groups.loose.length > 0 && (
        <div className="row">
          <button className="btn small" onClick={() => useUi.getState().startPlaylistSelection()}>
            <CircleCheck size={16} /> {t('select.start')}
          </button>
        </div>
      )}

      <PlaylistDnd playlists={playlists} folders={folders}>
        <div className="card-list">
          <Link href="/liked" className="card-row">
            <div
              className="collection-art liked single"
              style={{ width: 56, height: 56, borderRadius: 8 }}
            >
              <Heart size={24} fill="currentColor" />
            </div>
            <div className="grow">
              <div className="card-title">{t('liked.title')}</div>
              <div className="muted small">{songCount(t, liked)}</div>
            </div>
          </Link>

          {groups.folders.map(({ folder, playlists: inside }) => (
            <FolderRow key={folder.id} folder={folder} count={inside.length} t={t} />
          ))}

          {groups.loose.map((pl) => (
            <PlaylistRow key={pl.id} playlist={pl} />
          ))}
        </div>
      </PlaylistDnd>

      {playlists.length === 0 && folders.length === 0 && (
        <p className="empty">{t('playlists.empty')}</p>
      )}
      {openLink && <OpenLinkSheet onClose={() => setOpenLink(false)} />}
    </div>
  );
}

/** Paste (or, on Android, scan) a link a friend sent; opens the shared playlist. */
function OpenLinkSheet({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [, navigate] = useLocation();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = (raw: string) => {
    const link = parseHubLink(raw);
    if (link?.kind !== 'list') {
      setError(t('share.invalidLink'));
      return;
    }
    onClose();
    navigate(`/shared/${link.id}`);
  };

  const scan = async () => {
    try {
      const scanned = await scanQr();
      if (scanned !== null) open(scanned);
    } catch {
      setError(t('share.scannerUnavailable'));
    }
  };

  return (
    <Sheet onClose={onClose} label={t('share.openTitle')}>
      <div className="sheet-header">
        <div className="grow">
          <div className="track-title">{t('share.openTitle')}</div>
          <div className="faint small">{t('share.openText')}</div>
        </div>
      </div>
      <form
        className="sheet-body"
        onSubmit={(e) => {
          e.preventDefault();
          open(text);
        }}
      >
        <input
          className="input"
          style={{ alignSelf: 'stretch' }}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('share.openPlaceholder')}
          aria-label={t('share.openPlaceholder')}
          autoFocus
        />
        {error && <div className="error-text">{error}</div>}
        <div className="row wrap">
          <button className="btn primary small" type="submit" disabled={!text.trim()}>
            {t('share.openGo')}
          </button>
          {isNative && (
            <button className="btn small" type="button" onClick={() => void scan()}>
              <ScanLine size={16} /> {t('share.scan')}
            </button>
          )}
        </div>
      </form>
    </Sheet>
  );
}

function FolderRow({ folder, count, t }: { folder: Folder; count: number; t: Translate }) {
  const [menu, setMenu] = useState(false);
  return (
    <SortableFolder folderId={folder.id} pinned={folder.pinnedAt != null}>
      {(handle) => (
        <>
          <div className="card-row">
            <Link href={`/folder/${folder.id}`} className="card-row-link">
              <div
                className="collection-art single"
                style={{ width: 56, height: 56, borderRadius: 8 }}
              >
                <FolderIcon size={26} color="var(--accent)" />
              </div>
              <div className="grow">
                <div className="card-title ellipsis">{folder.name}</div>
                <div className="muted small">
                  {count === 1
                    ? t('folders.playlistCount.one')
                    : t('folders.playlistCount', { count })}
                </div>
              </div>
            </Link>
            <button
              className="icon-btn"
              onClick={() => setMenu(true)}
              aria-label={t('playlists.menu')}
              title={t('playlists.menu')}
            >
              <EllipsisVertical size={18} />
            </button>
            {handle}
          </div>
          {menu && <FolderMenu folder={folder} onClose={() => setMenu(false)} />}
        </>
      )}
    </SortableFolder>
  );
}

const LONG_PRESS_MS = 500;
const MOVE_TOLERANCE_PX = 8;

/** Long press on a row starts selecting playlists; `suppressClick` swallows the click after it. */
function useLongPressSelect(playlistId: string, selecting: boolean) {
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const origin = useRef({ x: 0, y: 0 });
  const suppressClick = useRef(false);
  const cancel = () => clearTimeout(timer.current);

  useEffect(() => cancel, []);
  // The row is swapped for a button when selecting starts, so that click may never arrive.
  useEffect(() => {
    suppressClick.current = false;
  }, [selecting]);

  const handlers = {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      origin.current = { x: e.clientX, y: e.clientY };
      cancel();
      timer.current = setTimeout(() => {
        suppressClick.current = true;
        navigator.vibrate?.(20);
        useUi.getState().startPlaylistSelection(playlistId);
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e: React.PointerEvent) => {
      const moved =
        Math.abs(e.clientX - origin.current.x) > MOVE_TOLERANCE_PX ||
        Math.abs(e.clientY - origin.current.y) > MOVE_TOLERANCE_PX;
      if (moved) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
  const takeSuppressedClick = () => {
    const was = suppressClick.current;
    suppressClick.current = false;
    return was;
  };
  return { handlers, takeSuppressedClick };
}

/** One playlist: link, "…" menu and the drag handle. Also used inside folders. */
export function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const t = useT();
  const tracks = useLibrary((s) => s.tracks);
  const [menu, setMenu] = useState(false);
  const selecting = useUi((s) => s.playlistSelection !== null);
  const picked = useUi((s) => !!s.playlistSelection?.includes(playlist.id));
  const { handlers, takeSuppressedClick } = useLongPressSelect(playlist.id, selecting);

  const body = (
    <>
      {selecting && (
        <span className="select-circle" aria-hidden>
          {picked ? <CircleCheck size={22} /> : <Circle size={22} />}
        </span>
      )}
      <PlaylistArt playlist={playlist} tracks={tracks} size={56} />
      <div className="grow">
        <div className="card-title ellipsis">{playlist.name}</div>
        <div className="muted small">{songCount(t, playlist.trackIds.length)}</div>
      </div>
    </>
  );

  return (
    <DraggablePlaylist playlist={playlist}>
      {(handle) => (
        <div className={`card-row${picked ? ' picked' : ''}`}>
          {selecting ? (
            <button
              className="card-row-link"
              aria-pressed={picked}
              onClick={() => useUi.getState().togglePlaylistSelected(playlist.id)}
            >
              {body}
            </button>
          ) : (
            <Link
              href={`/playlist/${playlist.id}`}
              className="card-row-link"
              onClick={(e) => {
                if (takeSuppressedClick()) e.preventDefault();
              }}
              {...handlers}
            >
              {body}
            </Link>
          )}
          <button
            className="icon-btn"
            onClick={() => setMenu(true)}
            aria-label={t('playlists.menu')}
            title={t('playlists.menu')}
          >
            <EllipsisVertical size={18} />
          </button>
          {handle}
          {menu && <PlaylistMenu playlist={playlist} onClose={() => setMenu(false)} />}
        </div>
      )}
    </DraggablePlaylist>
  );
}
