import { useMemo } from 'react';
import { create } from 'zustand';
import {
  LIMITS,
  reorderFolders,
  reorderPlaylists,
  sortFolders,
  type Folder,
  type Playlist,
} from '@aske/shared';
import { ApiError } from '../api/client';
import { t } from '../i18n';
import { squareJpeg } from '../lib/cover';
import { kvGet, kvSet, type CachedLibrary } from '../offline/db';
import { applyFolderDelete, applyMove, planMerge } from '../storage/playlistOps';
import type { LibrarySnapshot, LocalTrack } from '../storage/types';
import { getHome, useSetup } from './setup';
import { toast } from './ui';

interface LibraryState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  tracks: Record<string, LocalTrack>;
  /** Track ids, newest first. */
  order: string[];
  playlists: Playlist[];
  folders: Folder[];

  load: () => Promise<void>;
  /** Adds (or replaces) songs in memory after an import/download. */
  upsertTracks: (tracks: LocalTrack[]) => void;
  toggleLike: (trackId: string) => Promise<void>;
  likeMany: (trackIds: string[]) => Promise<void>;
  setKind: (trackId: string, kind: 'music' | 'podcast') => Promise<void>;
  reorderPlaylist: (id: string, trackIds: string[]) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
  createPlaylist: (name: string, trackIds?: string[]) => Promise<Playlist | null>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  /** `silent`: no toast (used by background downloads). */
  addToPlaylist: (id: string, trackIds: string[], silent?: boolean) => Promise<void>;
  removeFromPlaylist: (id: string, trackId: string) => Promise<void>;
  createFolder: (name: string) => Promise<Folder | null>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  movePlaylist: (id: string, folderId: string | null) => Promise<void>;
  /** Optimistic: reorders at once and rolls back (with the usual toast) if saving fails. */
  reorderFolders: (folderIds: string[]) => Promise<void>;
  setPlaylistPinned: (id: string, pinned: boolean) => Promise<void>;
  setFolderPinned: (id: string, pinned: boolean) => Promise<void>;
  orderPlaylists: (folderId: string | null, ids: string[]) => Promise<void>;
  /** Returns true when merged. Toast with the reason when not. */
  mergePlaylists: (targetId: string, sourceId: string, deleteSource: boolean) => Promise<boolean>;
  /** file: any image chosen by the user (null = back to the mosaic). Resized to a square. */
  setPlaylistCover: (id: string, file: Blob | null) => Promise<void>;
}

/** One cache per home, so switching storage never mixes libraries. */
const cacheKey = () => `library:${useSetup.getState().config?.home ?? 'none'}`;

function fromSnapshot(s: Omit<LibrarySnapshot, 'etag'>) {
  return {
    tracks: Object.fromEntries(s.tracks.map((tr) => [tr.id, tr])),
    order: s.tracks.map((tr) => tr.id),
    playlists: s.playlists,
    folders: s.folders ?? [],
  };
}

/** Saves the in-memory state locally (with an empty ETag, so the next load revalidates). */
async function persist(state: LibraryState, etag = '') {
  const library = {
    tracks: state.order.map((id) => state.tracks[id]!).filter(Boolean),
    playlists: state.playlists,
    folders: state.folders,
  };
  await kvSet(cacheKey(), { etag, library, savedAt: Date.now() } satisfies CachedLibrary);
}

function reportError(err: unknown) {
  if (err instanceof Error && err.message === 'cloudflare_outdated') {
    toast(t('toast.cloudflareOutdated'), 'error');
    return;
  }
  if (err instanceof Error && err.message === 'folder_not_found') {
    void useLibrary.getState().load();
    toast(t('toast.error'), 'error');
    return;
  }
  if (err instanceof ApiError && err.status === 0) toast(t('toast.offline'), 'error');
  else if (err instanceof ApiError && err.status !== 401) toast(err.message, 'error');
  else if (!(err instanceof ApiError)) toast(t('toast.error'), 'error');
}

/** `mutate` already reported generic errors; add the specific pin message unless outdated. */
function reportPinError(err: unknown) {
  if (err instanceof Error && err.message === 'cloudflare_outdated') return;
  toast(t('toast.pinFailed'), 'error');
}

function isStorageFull(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 507 || err.code === 'storage_full';
  return err instanceof Error && err.message.includes('storage_full');
}

export const useLibrary = create<LibraryState>((set, get) => {
  /** Applies an optimistic change, persists it, and rolls back on failure. */
  async function mutate(
    change: (s: LibraryState) => Partial<LibraryState>,
    call: () => Promise<unknown>,
  ) {
    const before = get();
    const snapshot = {
      tracks: before.tracks,
      order: before.order,
      playlists: before.playlists,
      folders: before.folders,
    };
    set(change(before));
    try {
      await call();
      await persist(get());
    } catch (err) {
      set(snapshot);
      reportError(err);
      throw err;
    }
  }

  const replacePlaylist = (pl: Playlist) =>
    set({ playlists: get().playlists.map((p) => (p.id === pl.id ? pl : p)) });

  return {
    loaded: false,
    loading: false,
    error: null,
    tracks: {},
    order: [],
    playlists: [],
    folders: [],

    /** Local copy first (instant start, works offline), then revalidate with the home. */
    async load() {
      if (get().loading) return;
      set({ loading: true, error: null });
      const cached = await kvGet<CachedLibrary>(cacheKey());
      if (cached && !get().loaded) set({ ...fromSnapshot(cached.library), loaded: true });
      try {
        const fresh = await getHome().load(cached?.etag || undefined);
        if (fresh) {
          const { etag, ...library } = fresh;
          set({ ...fromSnapshot(library), loaded: true });
          await kvSet(cacheKey(), { etag, library, savedAt: Date.now() } satisfies CachedLibrary);
        }
        set({ loading: false, loaded: true });
      } catch (err) {
        set({
          loading: false,
          loaded: get().loaded || !!cached,
          error: cached ? null : err instanceof Error ? err.message : 'error',
        });
      }
    },

    upsertTracks(tracks) {
      const map = { ...get().tracks };
      const order = [...get().order];
      for (const tr of tracks) {
        if (!map[tr.id]) order.unshift(tr.id);
        map[tr.id] = tr;
      }
      set({ tracks: map, order });
      void persist(get());
    },

    async toggleLike(trackId) {
      const track = get().tracks[trackId];
      if (!track) return;
      const liked = track.likedAt === null;
      await mutate(
        (s) => ({
          tracks: { ...s.tracks, [trackId]: { ...track, likedAt: liked ? Date.now() : null } },
        }),
        () => getHome().updateTrack(trackId, { liked }),
      ).catch(() => undefined);
    },

    async likeMany(trackIds) {
      const now = Date.now();
      const todo = trackIds.filter((id) => get().tracks[id]?.likedAt === null);
      await mutate(
        (s) => ({
          tracks: Object.fromEntries(
            Object.entries(s.tracks).map(([id, tr]) => [
              id,
              todo.includes(id) ? { ...tr, likedAt: now } : tr,
            ]),
          ),
        }),
        async () => {
          for (const id of todo) await getHome().updateTrack(id, { liked: true });
        },
      )
        .then(() => toast(t('toast.likedMany', { count: trackIds.length })))
        .catch(() => undefined);
    },

    async setKind(trackId, kind) {
      const track = get().tracks[trackId];
      if (!track) return;
      await mutate(
        (s) => ({ tracks: { ...s.tracks, [trackId]: { ...track, kind } } }),
        () => getHome().updateTrack(trackId, { kind }),
      )
        .then(() =>
          toast(kind === 'podcast' ? t('toast.movedToPodcasts') : t('toast.movedToMusic')),
        )
        .catch(() => undefined);
    },

    async reorderPlaylist(id, trackIds) {
      await mutate(
        (s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, trackIds } : p)) }),
        () => getHome().reorderPlaylist(id, trackIds),
      ).catch(() => undefined);
    },

    async deleteTrack(trackId) {
      try {
        await getHome().deleteTrack(trackId);
      } catch (err) {
        reportError(err);
        return;
      }
      const { [trackId]: _removed, ...tracks } = get().tracks;
      set({
        tracks,
        order: get().order.filter((id) => id !== trackId),
        playlists: get().playlists.map((p) => ({
          ...p,
          trackIds: p.trackIds.filter((id) => id !== trackId),
        })),
      });
      await persist(get());
      toast(t('toast.deleted'));
    },

    async createPlaylist(name, trackIds = []) {
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
        reportError(err);
        return null;
      }
    },

    async renamePlaylist(id, name) {
      try {
        replacePlaylist(await getHome().renamePlaylist(id, name));
        await persist(get());
      } catch (err) {
        reportError(err);
      }
    },

    async deletePlaylist(id) {
      await mutate(
        (s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }),
        () => getHome().deletePlaylist(id),
      ).catch(() => undefined);
    },

    async addToPlaylist(id, trackIds, silent = false) {
      const current = get().playlists.find((p) => p.id === id);
      if (current) {
        const total = new Set([...current.trackIds, ...trackIds]).size;
        if (total > LIMITS.playlistMaxTracks) {
          const free = Math.max(0, LIMITS.playlistMaxTracks - current.trackIds.length);
          toast(
            t('toast.playlistFull', {
              max: LIMITS.playlistMaxTracks,
              name: current.name,
              free,
            }),
          );
          return;
        }
      }
      try {
        const pl = await getHome().addToPlaylist(id, trackIds);
        replacePlaylist(pl);
        await persist(get());
        if (!silent) toast(t('toast.addedToPlaylist', { name: pl.name }));
      } catch (err) {
        reportError(err);
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

    async createFolder(name) {
      try {
        const folder = await getHome().createFolder(name);
        set({ folders: sortFolders([...get().folders, folder]) });
        await persist(get());
        toast(t('toast.folderCreated'));
        return folder;
      } catch (err) {
        reportError(err);
        return null;
      }
    },

    async renameFolder(id, name) {
      try {
        const folder = await getHome().renameFolder(id, name);
        set({ folders: get().folders.map((f) => (f.id === id ? folder : f)) });
        await persist(get());
      } catch (err) {
        reportError(err);
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

    async setPlaylistPinned(id, pinned) {
      const pinnedAt = pinned ? Date.now() : null;
      await mutate(
        (s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, pinnedAt } : p)) }),
        async () => replacePlaylist(await getHome().setPlaylistPinned(id, pinned)),
      ).catch(reportPinError);
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

    async orderPlaylists(folderId, ids) {
      await mutate(
        (s) => ({ playlists: reorderPlaylists(s.playlists, folderId, ids, Date.now()).playlists }),
        async () => set({ playlists: await getHome().orderPlaylists(folderId, ids) }),
      ).catch(() => undefined);
    },

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
        // The first call may have gone through: resync with the real state.
        void get().load();
        return false;
      }
      toast(t('toast.merged', { count: plan.added, name: target.name }));
      return true;
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
        else reportError(err);
      }
    },
  };
});

/** Ordered tracks of the library (newest first), memoised per state change. */
export function useAllTracks(): LocalTrack[] {
  const order = useLibrary((s) => s.order);
  const tracks = useLibrary((s) => s.tracks);
  return useMemo(
    () => order.map((id) => tracks[id]).filter((tr): tr is LocalTrack => !!tr),
    [order, tracks],
  );
}
