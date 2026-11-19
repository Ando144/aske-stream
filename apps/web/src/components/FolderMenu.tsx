import { Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import type { Folder } from '@aske/shared';
import { useT } from '../i18n';
import { useLibrary } from '../stores/library';
import { confirmDialog, promptDialog } from '../stores/ui';
import { Sheet } from './Sheet';

/** The «…» sheet of a folder: rename or delete (its playlists are kept). */
export function FolderMenu({ folder, onClose }: { folder: Folder; onClose: () => void }) {
  const t = useT();

  const rename = async () => {
    onClose();
    const name = await promptDialog({
      title: t('folders.rename'),
      placeholder: t('folders.namePlaceholder'),
      initial: folder.name,
      confirmLabel: t('common.save'),
    });
    if (name && name !== folder.name) await useLibrary.getState().renameFolder(folder.id, name);
  };

  const pinned = folder.pinnedAt != null;
  const togglePin = async () => {
    onClose();
    await useLibrary.getState().setFolderPinned(folder.id, !pinned);
  };

  const remove = async () => {
    onClose();
    const ok = await confirmDialog(
      t('folders.deleteConfirm', { name: folder.name }),
      t('common.delete'),
      true,
    );
    if (ok) await useLibrary.getState().deleteFolder(folder.id);
  };

  return (
    <Sheet onClose={onClose} label={folder.name}>
      <div className="sheet-header">
        <div className="grow">
          <div className="track-title">{folder.name}</div>
        </div>
      </div>
      <button className="menu-item" onClick={() => void rename()}>
        <Pencil size={20} /> {t('folders.rename')}
      </button>
      <button className="menu-item" onClick={() => void togglePin()}>
        {pinned ? <PinOff size={20} /> : <Pin size={20} />} {t(pinned ? 'pin.unpin' : 'pin.pin')}
      </button>
      <button className="menu-item danger" onClick={() => void remove()}>
        <Trash2 size={20} /> {t('folders.delete')}
      </button>
    </Sheet>
  );
}
