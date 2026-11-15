import { useMemo } from 'react';
import { create } from 'zustand';
import type { Playlist } from '@aske/shared';
import { ApiError } from '../api/client';
import { t } from '../i18n';
import { kvGet, kvSet, type CachedLibrary } from '../offline/db';
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
  addToPlaylist: (id: string, trackIds: string[]) => Promise<void>;
  removeFromPlaylist: (id: string, trackId: string) => Promise<void>;
}

/** One cache per home, so switching storage never mixes libraries. */
const cacheKey = () => `library:${useSetup.getState().config?.home ?? 'none'}`;

function fromSnapshot(s: Omit<LibrarySnapshot, 'etag'>) {
  return {
    tracks: Object.fromEntries(s.tracks.map((tr) => [tr.id, tr])),
    order: s.tracks.map((tr) => tr.id),
    playlists: s.playlists,
  };
}

/** Saves the in-memory state locally (with an empty ETag, so the next load revalidates). */
async function persist(state: LibraryState, etag = '') {
  const library = {
    tracks: state.order.map((id) => state.tracks[id]!).filter(Boolean),
    playlists: state.playlists,
  };
  await kvSet(cacheKey(), { etag, library, savedAt: Date.now() } satisfies CachedLibrary);
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

    async addToPlaylist(id, trackIds) {
      try {
        const pl = await getHome().addToPlaylist(id, trackIds);
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
        () => getHome().removeFromPlaylist(id, trackId),
      )
        .then(() => pl && toast(t('toast.removedFromPlaylist', { name: pl.name })))
        .catch(() => undefined);
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
