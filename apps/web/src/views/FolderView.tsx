import { useState } from 'react';
import { ChevronLeft, EllipsisVertical, Folder as FolderIcon } from 'lucide-react';
import { Link } from 'wouter';
import { useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { FolderMenu } from '../components/FolderMenu';
import { PlaylistDnd } from '../components/PlaylistDnd';
import { PlaylistRow } from './PlaylistsView';

export function FolderView({ id }: { id: string }) {
  const t = useT();
  const folder = useLibrary((s) => s.folders.find((f) => f.id === id));
  const playlists = useLibrary((s) => s.playlists);
  const [menu, setMenu] = useState(false);

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

  const inside = playlists.filter((p) => p.folderId === id);

  return (
    <div className="page">
      <Link href="/playlists" className="icon-btn" aria-label={t('common.back')}>
        <ChevronLeft size={24} />
      </Link>
      <header className="page-header">
        <h1 className="row ellipsis">
          <FolderIcon size={24} color="var(--accent)" /> {folder.name}
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
