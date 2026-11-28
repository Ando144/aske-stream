import { reorderFolders, sortFolders } from '@aske/shared';
import { t } from '../i18n';
import { applyFolderDelete, applyMove } from '../storage/playlistOps';
import { persist } from './libraryCache';
import { reportError, reportPinError } from './libraryErrors';
import type { LibraryCtx, LibraryState } from './libraryState';
import { getHome } from './setup';
import { toast } from './ui';

function createEditActions(
  ctx: LibraryCtx,
): Pick<LibraryState, 'createFolder' | 'renameFolder' | 'deleteFolder'> {
  const { get, set, mutate, reload } = ctx;
  return {
    async createFolder(name) {
      try {
        const folder = await getHome().createFolder(name);
        set({ folders: sortFolders([...get().folders, folder]) });
        await persist(get());
        toast(t('toast.folderCreated'));
        return folder;
      } catch (err) {
        reportError(err, reload);
        return null;
      }
    },

    async renameFolder(id, name) {
      try {
        const folder = await getHome().renameFolder(id, name);
        set({ folders: get().folders.map((f) => (f.id === id ? folder : f)) });
        await persist(get());
      } catch (err) {
        reportError(err, reload);
      }
    },

    async deleteFolder(id) {
      await mutate(
        (s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          playlists: applyFolderDelete(s.playlists, id),
        }),
        () => getHome().deleteFolder(id),
      ).catch(() => undefined);
    },
  };
}

function createArrangeActions(
  ctx: LibraryCtx,
): Pick<LibraryState, 'movePlaylist' | 'reorderFolders' | 'setFolderPinned'> {
  const { get, set, mutate } = ctx;
  return {
    async movePlaylist(id, folderId) {
      const folder = get().folders.find((f) => f.id === folderId);
      await mutate(
        (s) => ({ playlists: applyMove(s.playlists, id, folderId) }),
        () => getHome().movePlaylist(id, folderId),
      )
        .then(() =>
          toast(folder ? t('toast.movedToFolder', { name: folder.name }) : t('toast.movedOut')),
        )
        .catch(() => undefined);
    },

    async reorderFolders(folderIds) {
      await mutate(
        (s) => ({ folders: reorderFolders(s.folders, folderIds, Date.now()).folders }),
        async () => set({ folders: await getHome().reorderFolders(folderIds) }),
      ).catch(() => undefined);
    },

    async setFolderPinned(id, pinned) {
      const pinnedAt = pinned ? Date.now() : null;
      await mutate(
        (s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, pinnedAt } : f)) }),
        async () => {
          const folder = await getHome().setFolderPinned(id, pinned);
          set({ folders: get().folders.map((f) => (f.id === id ? folder : f)) });
        },
      ).catch(reportPinError);
    },
  };
}

export function createFolderActions(ctx: LibraryCtx) {
  return {
    ...createEditActions(ctx),
    ...createArrangeActions(ctx),
  };
}
