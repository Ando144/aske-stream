import { useRef } from 'react';
import { Folder as FolderIcon, FolderPlus, Image, ImageOff } from 'lucide-react';
import type { Playlist } from '@aske/shared';
import { useT, type Translate } from '../i18n';
import { useLibrary } from '../stores/library';
import { confirmDialog, promptDialog } from '../stores/ui';
import { PlaylistArt } from './PlaylistArt';
import { Sheet } from './Sheet';

const store = useLibrary.getState;

export async function renamePlaylistFlow(playlist: Playlist, t: Translate, onClose: () => void) {
  onClose();
  const name = await promptDialog({
    title: t('playlists.rename'),
    placeholder: t('playlists.namePlaceholder'),
    initial: playlist.name,
    confirmLabel: t('common.save'),
  });
  if (name && name !== playlist.name) await store().renamePlaylist(playlist.id, name);
}

export async function deletePlaylistFlow(
  playlist: Playlist,
  t: Translate,
  navigate: (path: string) => void,
  onClose: () => void,
) {
  onClose();
  const ok = await confirmDialog(
    t('playlists.deleteConfirm', { name: playlist.name }),
    t('common.delete'),
    true,
  );
  if (!ok) return;
  navigate('/playlists');
  await store().deletePlaylist(playlist.id);
}

export async function newFolderFlow(playlist: Playlist, t: Translate, onClose: () => void) {
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
}

/** «Choose cover» and «Remove cover» entries, with the hidden file input. */
export function CoverItems({ playlist, onClose }: { playlist: Playlist; onClose: () => void }) {
  const t = useT();
  const fileInput = useRef<HTMLInputElement>(null);

  const setCover = (file: File | null | undefined) => {
    onClose();
    if (file !== undefined) void store().setPlaylistCover(playlist.id, file);
  };

  return (
    <>
      <button className="menu-item" onClick={() => fileInput.current?.click()}>
        <Image size={20} /> {t('playlists.coverPick')}
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => setCover(e.target.files?.[0])}
      />
      {playlist.coverAt && (
        <button className="menu-item" onClick={() => setCover(null)}>
          <ImageOff size={20} /> {t('playlists.coverRemove')}
        </button>
      )}
    </>
  );
}

/** Step of the «…» sheet: choose the folder to move the playlist into. */
export function FolderPickSheet({
  playlist,
  onMove,
  onClose,
}: {
  playlist: Playlist;
  onMove: (folderId: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const folders = useLibrary((s) => s.folders);
  return (
    <Sheet onClose={onClose} label={t('playlists.pickFolder')}>
      <h2>{t('playlists.pickFolder')}</h2>
      {folders
        .filter((f) => f.id !== playlist.folderId)
        .map((f) => (
          <button key={f.id} className="menu-item" onClick={() => onMove(f.id)}>
            <FolderIcon size={20} /> {f.name}
          </button>
        ))}
      <button className="menu-item" onClick={() => void newFolderFlow(playlist, t, onClose)}>
        <FolderPlus size={20} /> {t('playlists.newFolderHere')}
      </button>
    </Sheet>
  );
}

/** Step of the «…» sheet: choose which playlist to merge with. */
export function MergePickSheet({
  playlist,
  onPick,
  onClose,
}: {
  playlist: Playlist;
  onPick: (otherId: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const playlists = useLibrary((s) => s.playlists);
  const tracks = useLibrary((s) => s.tracks);
  return (
    <Sheet onClose={onClose} label={t('playlists.mergePick')}>
      <h2>{t('playlists.mergePick')}</h2>
      {playlists
        .filter((p) => p.id !== playlist.id)
        .map((p) => (
          <button key={p.id} className="menu-item" onClick={() => onPick(p.id)}>
            <PlaylistArt playlist={p} tracks={tracks} size={32} /> {p.name}
          </button>
        ))}
    </Sheet>
  );
}
