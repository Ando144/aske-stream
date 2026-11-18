import { useState } from 'react';
import { EllipsisVertical, Folder as FolderIcon, FolderPlus, Heart, Plus } from 'lucide-react';
import { Link } from 'wouter';
import type { Folder, Playlist } from '@aske/shared';
import { songCount, useT, type Translate } from '../i18n';
import { groupPlaylists } from '../storage/playlistOps';
import { useAllTracks, useLibrary } from '../stores/library';
import { promptDialog } from '../stores/ui';
import { FolderMenu } from '../components/FolderMenu';
import { DraggablePlaylist, DroppableFolder, PlaylistDnd } from '../components/PlaylistDnd';
import { PlaylistArt } from '../components/PlaylistArt';
import { PlaylistMenu } from '../components/PlaylistMenu';
import { SettingsLink } from '../components/SettingsLink';
import { ScreenTip } from '../components/ScreenTip';

export function PlaylistsView() {
  const t = useT();
  const playlists = useLibrary((s) => s.playlists);
  const folders = useLibrary((s) => s.folders);
  const liked = useAllTracks().filter((tr) => tr.likedAt !== null).length;
  const groups = groupPlaylists(playlists, folders);

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
        <div className="row">
          <button className="btn small" onClick={() => void createFolder()}>
            <FolderPlus size={16} /> {t('folders.new')}
          </button>
          <button className="btn primary small" onClick={() => void create()}>
            <Plus size={16} /> {t('playlists.new')}
          </button>
          <SettingsLink />
        </div>
      </header>
      <ScreenTip id="playlists" text="tips.playlists" helpId="playlists" />

      <PlaylistDnd playlists={playlists}>
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
    </div>
  );
}

function FolderRow({ folder, count, t }: { folder: Folder; count: number; t: Translate }) {
  const [menu, setMenu] = useState(false);
  return (
    <DroppableFolder folderId={folder.id}>
      <div className="card-row">
        <Link href={`/folder/${folder.id}`} className="card-row-link">
          <div className="collection-art single" style={{ width: 56, height: 56, borderRadius: 8 }}>
            <FolderIcon size={26} color="var(--accent)" />
          </div>
          <div className="grow">
            <div className="card-title ellipsis">{folder.name}</div>
            <div className="muted small">
              {count === 1 ? t('folders.playlistCount.one') : t('folders.playlistCount', { count })}
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
      </div>
      {menu && <FolderMenu folder={folder} onClose={() => setMenu(false)} />}
    </DroppableFolder>
  );
}

/** One playlist: link, "…" menu and the drag handle. Also used inside folders. */
export function PlaylistRow({ playlist }: { playlist: Playlist }) {
  const t = useT();
  const tracks = useLibrary((s) => s.tracks);
  const [menu, setMenu] = useState(false);
  return (
    <DraggablePlaylist playlist={playlist}>
      {(handle) => (
        <div className="card-row">
          <Link href={`/playlist/${playlist.id}`} className="card-row-link">
            <PlaylistArt playlist={playlist} tracks={tracks} size={56} />
            <div className="grow">
              <div className="card-title ellipsis">{playlist.name}</div>
              <div className="muted small">{songCount(t, playlist.trackIds.length)}</div>
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
          {menu && <PlaylistMenu playlist={playlist} onClose={() => setMenu(false)} />}
        </div>
      )}
    </DraggablePlaylist>
  );
}
