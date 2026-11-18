import { useRef, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Folder as FolderIcon,
  FolderMinus,
  FolderPlus,
  Image,
  ImageOff,
  Merge,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { Playlist } from '@aske/shared';
import { useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { confirmDialog, promptDialog } from '../stores/ui';
import { MergeSheet } from './MergeSheet';
import { PlaylistArt } from './PlaylistArt';
import { Sheet } from './Sheet';

type Step = 'main' | 'folders' | 'merge';

/** The «…» sheet of a playlist. */
export function PlaylistMenu({ playlist, onClose }: { playlist: Playlist; onClose: () => void }) {
  const t = useT();
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>('main');
  const [mergeWith, setMergeWith] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const folders = useLibrary((s) => s.folders);
  const playlists = useLibrary((s) => s.playlists);
  const tracks = useLibrary((s) => s.tracks);
  const store = useLibrary.getState;

  if (mergeWith) {
    return <MergeSheet targetId={playlist.id} sourceId={mergeWith} onClose={onClose} />;
  }

  const rename = async () => {
    onClose();
    const name = await promptDialog({
      title: t('playlists.rename'),
      placeholder: t('playlists.namePlaceholder'),
      initial: playlist.name,
      confirmLabel: t('common.save'),
    });
    if (name && name !== playlist.name) await store().renamePlaylist(playlist.id, name);
  };

  const remove = async () => {
    onClose();
    const ok = await confirmDialog(
      t('playlists.deleteConfirm', { name: playlist.name }),
      t('common.delete'),
      true,
    );
    if (!ok) return;
    navigate('/playlists');
    await store().deletePlaylist(playlist.id);
  };

  const moveTo = (folderId: string | null) => {
    onClose();
    void store().movePlaylist(playlist.id, folderId);
  };

  const newFolder = async () => {
    onClose();
    const name = await promptDialog({
      title: t('folders.new'),
      placeholder: t('folders.namePlaceholder'),
      initial: '',
      confirmLabel: t('common.create'),
    });
    if (!name) return;
    const folder = await store().createFolder(name);
    if (folder) await store().movePlaylist(playlist.id, folder.id);
  };

  const pickPhoto = (file: File | undefined) => {
    onClose();
    if (file) void store().setPlaylistCover(playlist.id, file);
  };

  if (step === 'folders') {
    return (
      <Sheet onClose={onClose} label={t('playlists.pickFolder')}>
        <h2>{t('playlists.pickFolder')}</h2>
        {folders
          .filter((f) => f.id !== playlist.folderId)
          .map((f) => (
            <button key={f.id} className="menu-item" onClick={() => moveTo(f.id)}>
              <FolderIcon size={20} /> {f.name}
            </button>
          ))}
        <button className="menu-item" onClick={() => void newFolder()}>
          <FolderPlus size={20} /> {t('playlists.newFolderHere')}
        </button>
      </Sheet>
    );
  }

  if (step === 'merge') {
    const others = playlists.filter((p) => p.id !== playlist.id);
    return (
      <Sheet onClose={onClose} label={t('playlists.mergePick')}>
        <h2>{t('playlists.mergePick')}</h2>
        {others.map((p) => (
          <button key={p.id} className="menu-item" onClick={() => setMergeWith(p.id)}>
            <PlaylistArt playlist={p} tracks={tracks} size={32} /> {p.name}
          </button>
        ))}
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} label={playlist.name}>
      <div className="sheet-header">
        <PlaylistArt playlist={playlist} tracks={tracks} size={48} />
        <div className="grow">
          <div className="track-title">{playlist.name}</div>
        </div>
      </div>
      <button className="menu-item" onClick={() => void rename()}>
        <Pencil size={20} /> {t('playlists.rename')}
      </button>
      <button className="menu-item" onClick={() => setStep('folders')}>
        <FolderIcon size={20} /> {t('playlists.moveToFolder')}
      </button>
      {playlist.folderId && (
        <button className="menu-item" onClick={() => moveTo(null)}>
          <FolderMinus size={20} /> {t('playlists.moveOut')}
        </button>
      )}
      {playlists.length > 1 && (
        <button className="menu-item" onClick={() => setStep('merge')}>
          <Merge size={20} /> {t('playlists.merge')}
        </button>
      )}
      <button className="menu-item" onClick={() => fileInput.current?.click()}>
        <Image size={20} /> {t('playlists.coverPick')}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => pickPhoto(e.target.files?.[0])}
      />
      {playlist.coverAt && (
        <button
          className="menu-item"
          onClick={() => {
            onClose();
            void store().setPlaylistCover(playlist.id, null);
          }}
        >
          <ImageOff size={20} /> {t('playlists.coverRemove')}
        </button>
      )}
      <button className="menu-item danger" onClick={() => void remove()}>
        <Trash2 size={20} /> {t('playlists.delete')}
      </button>
    </Sheet>
  );
}
