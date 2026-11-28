import { LIMITS, reorderPlaylists, type Playlist } from '@aske/shared';
import { t } from '../i18n';
import { squareJpeg } from '../lib/cover';
import { planMerge } from '../storage/playlistOps';
import { persist } from './libraryCache';
import { isStorageFull, reportError, reportPinError } from './libraryErrors';
import type { LibraryCtx, LibraryState } from './libraryState';
import { getHome } from './setup';
import { toast } from './ui';

/** Toasts the reason and returns false when the songs do not fit in the playlist. */
function fitsInPlaylist(current: Playlist, trackIds: string[]): boolean {
  const total = new Set([...current.trackIds, ...trackIds]).size;
  if (total <= LIMITS.playlistMaxTracks) return true;
  const free = Math.max(0, LIMITS.playlistMaxTracks - current.trackIds.length);
  toast(t('toast.playlistFull', { max: LIMITS.playlistMaxTracks, name: current.name, free }));
  return false;
}

function createEditActions(
  ctx: LibraryCtx,
): Pick<LibraryState, 'createPlaylist' | 'renamePlaylist' | 'deletePlaylist'> {
  const { get, set, mutate, replacePlaylist, forPlaylist, reload } = ctx;
  return {
    async createPlaylist(name, requested = []) {
      const { allowed: trackIds, nothingLeft } = forPlaylist(requested);
      if (nothingLeft) return null;
      if (new Set(trackIds).size > LIMITS.playlistMaxTracks) {
        toast(t('toast.playlistTooBig', { max: LIMITS.playlistMaxTracks }));
        return null;
      }
      try {
        const pl = await getHome().createPlaylist(name, trackIds);
        set({ playlists: [...get().playlists, pl] });
        await persist(get());
        toast(
          trackIds.length
            ? t('toast.addedToPlaylist', { name: pl.name })
            : t('toast.playlistCreated'),
        );
        return pl;
      } catch (err) {
        reportError(err, reload);
        return null;
      }
    },

    async renamePlaylist(id, name) {
      try {
        replacePlaylist(await getHome().renamePlaylist(id, name));
        await persist(get());
      } catch (err) {
        reportError(err, reload);
      }
    },

    async deletePlaylist(id) {
      await mutate(
        (s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }),
        () => getHome().deletePlaylist(id),
      ).catch(() => undefined);
    },
  };
}

function createContentActions(
  ctx: LibraryCtx,
): Pick<LibraryState, 'addToPlaylist' | 'removeFromPlaylist'> {
  const { get, mutate, replacePlaylist, forPlaylist, reload } = ctx;
  return {
    async addToPlaylist(id, requested, silent = false) {
      const { allowed: trackIds, nothingLeft } = forPlaylist(requested, silent);
      if (nothingLeft) return;
      const current = get().playlists.find((p) => p.id === id);
      if (current && !fitsInPlaylist(current, trackIds)) return;
      try {
        const pl = await getHome().addToPlaylist(id, trackIds);
        replacePlaylist(pl);
        await persist(get());
        if (!silent) toast(t('toast.addedToPlaylist', { name: pl.name }));
      } catch (err) {
        reportError(err, reload);
      }
    },

    async removeFromPlaylist(id, trackId) {
      const pl = get().playlists.find((p) => p.id === id);
      await mutate(
        (s) => ({
          playlists: s.playlists.map((p) =>
            p.id === id ? { ...p, trackIds: p.trackIds.filter((x) => x !== trackId) } : p,
          ),
        }),
        () => getHome().removeFromPlaylist(id, trackId),
      )
        .then(() => pl && toast(t('toast.removedFromPlaylist', { name: pl.name })))
        .catch(() => undefined);
    },
  };
}

function createArrangeActions(
  ctx: LibraryCtx,
): Pick<LibraryState, 'setPlaylistPinned' | 'orderPlaylists' | 'setPlaylistCover'> {
  const { get, set, mutate, replacePlaylist, reload } = ctx;
  return {
    async setPlaylistPinned(id, pinned) {
      const pinnedAt = pinned ? Date.now() : null;
      await mutate(
        (s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, pinnedAt } : p)) }),
        async () => replacePlaylist(await getHome().setPlaylistPinned(id, pinned)),
      ).catch(reportPinError);
    },

    async orderPlaylists(folderId, ids) {
      await mutate(
        (s) => ({ playlists: reorderPlaylists(s.playlists, folderId, ids, Date.now()).playlists }),
        async () => set({ playlists: await getHome().orderPlaylists(folderId, ids) }),
      ).catch(() => undefined);
    },

    async setPlaylistCover(id, file) {
      try {
        const jpeg = file ? await squareJpeg(file, LIMITS.playlistCoverPx) : null;
        if (file && !jpeg) {
          toast(t('toast.coverBadImage'), 'error');
          return;
        }
        replacePlaylist(await getHome().setPlaylistCover(id, jpeg));
        await persist(get());
        if (jpeg) toast(t('toast.coverSaved'));
      } catch (err) {
        if (isStorageFull(err)) toast(t('toast.coverStorageFull'), 'error');
        else reportError(err, reload);
      }
    },
  };
}

function createMergeActions(ctx: LibraryCtx): Pick<LibraryState, 'mergePlaylists'> {
  const { get, mutate, reload } = ctx;
  return {
    async mergePlaylists(targetId, sourceId, deleteSource) {
      const { playlists } = get();
      const target = playlists.find((p) => p.id === targetId);
      const source = playlists.find((p) => p.id === sourceId);
      if (!target || !source) return false;
      const plan = planMerge(target, source);
      if (!plan.ok) {
        if (plan.reason === 'too_many') {
          toast(t('toast.mergeTooBig', { total: plan.total, max: plan.max }));
        }
        return false;
      }
      try {
        await mutate(
          (s) => ({
            playlists: s.playlists
              .map((p) => (p.id === targetId ? { ...p, trackIds: plan.trackIds } : p))
              .filter((p) => !(deleteSource && p.id === sourceId)),
          }),
          async () => {
            await getHome().addToPlaylist(targetId, source.trackIds);
            if (deleteSource) await getHome().deletePlaylist(sourceId);
          },
        );
      } catch {
        // `mutate` already reported it. The first call may have gone through: resync.
        void reload();
        return false;
      }
      toast(t('toast.merged', { count: plan.added, name: target.name }));
      return true;
    },
  };
}

export function createPlaylistActions(ctx: LibraryCtx) {
  return {
    ...createEditActions(ctx),
    ...createContentActions(ctx),
    ...createArrangeActions(ctx),
    ...createMergeActions(ctx),
  };
}
