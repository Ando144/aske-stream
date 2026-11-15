import { useMemo } from 'react';
import { create } from 'zustand';
import type { Library, Playlist, Track } from '@aske/shared';
import { api, ApiError } from '../api/client';
import { t } from '../i18n';
import { kvGet, kvSet, type CachedLibrary } from '../offline/db';
import { toast } from './ui';

interface LibraryState {
  loaded: boolean;
  loading: boolean;
  error: string | null;
  tracks: Record<string, Track>;
  /** Track ids, newest first (server order). */
  order: string[];
  playlists: Playlist[];

  load: () => Promise<void>;
  toggleLike: (trackId: string) => Promise<void>;
  deleteTrack: (trackId: string) => Promise<void>;
  createPlaylist: (name: string, trackIds?: string[]) => Promise<Playlist | null>;
  renamePlaylist: (id: string, name: string) => Promise<void>;
  deletePlaylist: (id: string) => Promise<void>;
  addToPlaylist: (id: string, trackIds: string[]) => Promise<void>;
  removeFromPlaylist: (id: string, trackId: string) => Promise<void>;
}

const CACHE_KEY = 'library';

function fromLibrary(library: Library) {
  return {
    tracks: Object.fromEntries(library.tracks.map((tr) => [tr.id, tr])),
    order: library.tracks.map((tr) => tr.id),
    playlists: library.playlists,
  };
}

/** Writes the current in-memory state back to IndexedDB (keeps the old ETag stale on purpose). */
async function persist(state: LibraryState, etag = '') {
  const library: Library = {
    version: -1,
    tracks: state.order.map((id) => state.tracks[id]!).filter(Boolean),
    playlists: state.playlists,
  };
  await kvSet(CACHE_KEY, { etag, library, savedAt: Date.now() } satisfies CachedLibrary);
}

function reportError(err: unknown) {
  if (err instanceof ApiError && err.status === 0) toast(t('toast.offline'), 'error');
  else if (err instanceof ApiError && err.status !== 401) toast(err.message, 'error');
  else if (!(err instanceof ApiError)) toast(t('toast.error'), 'error');
}

export const useLibrary = create<LibraryState>((set, get) => {
  /** Applies an optimistic change, persists it, and rolls back on failure. */
  async function mutate(
    change: (s: LibraryState) => Partial<LibraryState>,
    call: () => Promise<unknown>,
  ) {
    const before = get();
    const snapshot = { tracks: before.tracks, order: before.order, playlists: before.playlists };
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

    /** Cache first (instant start, works offline), then revalidate with the ETag. */
    async load() {
      if (get().loading) return;
      set({ loading: true, error: null });
      const cached = await kvGet<CachedLibrary>(CACHE_KEY);
      if (cached && !get().loaded) set({ ...fromLibrary(cached.library), loaded: true });
      try {
        const fresh = await api.library(cached?.etag || undefined);
        if (fresh) {
          set({ ...fromLibrary(fresh.library), loaded: true });
          await kvSet(CACHE_KEY, { ...fresh, savedAt: Date.now() } satisfies CachedLibrary);
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

    async toggleLike(trackId) {
      const track = get().tracks[trackId];
      if (!track) return;
      const liked = track.likedAt === null;
      await mutate(
        (s) => ({
          tracks: { ...s.tracks, [trackId]: { ...track, likedAt: liked ? Date.now() : null } },
        }),
        () => api.updateTrack(trackId, { liked }),
      ).catch(() => undefined);
    },

    async deleteTrack(trackId) {
      try {
        await api.deleteTrack(trackId);
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
      try {
        const pl = await api.createPlaylist(name, trackIds);
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
        replacePlaylist(await api.updatePlaylist(id, { name }));
        await persist(get());
      } catch (err) {
        reportError(err);
      }
    },

    async deletePlaylist(id) {
      await mutate(
        (s) => ({ playlists: s.playlists.filter((p) => p.id !== id) }),
        () => api.deletePlaylist(id),
      ).catch(() => undefined);
    },

    async addToPlaylist(id, trackIds) {
      try {
        const pl = await api.addToPlaylist(id, trackIds);
        replacePlaylist(pl);
        await persist(get());
        toast(t('toast.addedToPlaylist', { name: pl.name }));
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
        () => api.removeFromPlaylist(id, trackId),
      )
        .then(() => pl && toast(t('toast.removedFromPlaylist', { name: pl.name })))
        .catch(() => undefined);
    },
  };
});

/** Ordered tracks of the library (newest first), memoised per state change. */
export function useAllTracks(): Track[] {
  const order = useLibrary((s) => s.order);
  const tracks = useLibrary((s) => s.tracks);
  return useMemo(
    () => order.map((id) => tracks[id]).filter((tr): tr is Track => !!tr),
    [order, tracks],
  );
}
