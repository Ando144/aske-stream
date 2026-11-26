import { useEffect, useState } from 'react';
import { ChevronLeft, CircleCheck, EllipsisVertical, Folder as FolderIcon } from 'lucide-react';
import { Link } from 'wouter';
import { sortPlaylists } from '@aske/shared';
import { useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { useUi } from '../stores/ui';
import '../playlistSelect.css';
import { FolderMenu } from '../components/FolderMenu';
import { PlaylistDnd } from '../components/PlaylistDnd';
import { PlaylistRow } from './PlaylistsView';

export function FolderView({ id }: { id: string }) {
  const t = useT();
  const folder = useLibrary((s) => s.folders.find((f) => f.id === id));
  const playlists = useLibrary((s) => s.playlists);
  const [menu, setMenu] = useState(false);
  const insideKey = playlists
    .filter((p) => p.folderId === id)
    .map((p) => p.id)
    .join(',');
  useEffect(() => {
    useUi.getState().setPlaylistVisibleIds(insideKey ? insideKey.split(',') : []);
  }, [insideKey]);

  if (!folder) {
    return (
      <div className="page">
        <Link href="/playlists" className="icon-btn" aria-label={t('common.back')}>
          <ChevronLeft size={24} />
        </Link>
        <p className="empty">{t('folders.notFound')}</p>
      </div>
    );
  }

  const inside = sortPlaylists(playlists.filter((p) => p.folderId === id));

  return (
    <div className="page">
      <Link href="/playlists" className="icon-btn" aria-label={t('common.back')}>
        <ChevronLeft size={24} />
      </Link>
      <header className="page-header">
        <h1 className="row">
          <FolderIcon size={24} color="var(--accent)" style={{ flexShrink: 0 }} />
          <span className="ellipsis" style={{ minWidth: 0 }}>
            {folder.name}
          </span>
        </h1>
        <button
          className="icon-btn"
          onClick={() => setMenu(true)}
          aria-label={t('playlists.menu')}
          title={t('playlists.menu')}
        >
          <EllipsisVertical size={20} />
        </button>
      </header>
      {inside.length > 0 && (
        <div className="row playlists-select-row">
          <button className="btn small" onClick={() => useUi.getState().startPlaylistSelection()}>
            <CircleCheck size={16} /> {t('select.start')}
          </button>
        </div>
      )}

      <PlaylistDnd playlists={playlists} rootZone>
        <div className="card-list">
          {inside.map((pl) => (
            <PlaylistRow key={pl.id} playlist={pl} />
          ))}
        </div>
      </PlaylistDnd>

      {inside.length === 0 && <p className="empty">{t('folders.empty')}</p>}
      {menu && <FolderMenu folder={folder} onClose={() => setMenu(false)} />}
    </div>
  );
}
