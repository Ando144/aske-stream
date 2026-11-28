import { useMemo } from 'react';
import { create } from 'zustand';
import { t } from '../i18n';
import { isTimeout, withTimeout } from '../lib/timeout';
import { kvGet, kvSet, type CachedLibrary } from '../offline/db';
import { isOnlyOnDevice } from '../storage/localExtras';
import type { LocalTrack } from '../storage/types';
import { useConnectivity } from './connectivity';
import { cacheKey, extrasStore, fromSnapshotWithExtras, homeKind, persist } from './libraryCache';
import { reportError } from './libraryErrors';
import { createFolderActions } from './libraryFolderActions';
import { createPlaylistActions } from './libraryPlaylistActions';
import type { LibraryCtx, LibraryState } from './libraryState';
import { createTrackActions } from './libraryTrackActions';
import { getHome } from './setup';
import { toast } from './ui';

export type { LibraryState };

// A big library can take longer than the connectivity probe.
const LOAD_TIMEOUT_MS = 20_000;

function createContext(set: LibraryCtx['set'], get: LibraryCtx['get']): LibraryCtx {
  const reload = () => get().load();

  const mutate: LibraryCtx['mutate'] = async (change, call) => {
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
      reportError(err, reload);
      throw err;
    }
  };

  const isExtra = (id: string) => {
    const track = get().tracks[id];
    return !!track && isOnlyOnDevice(track, homeKind());
  };

  return {
    get,
    set,
    mutate,
    reload,
    isExtra,
    replacePlaylist: (pl) =>
      set({ playlists: get().playlists.map((p) => (p.id === pl.id ? pl : p)) }),
    storeFor: (id) => (isExtra(id) ? extrasStore : getHome()),
    forPlaylist(trackIds, silent = false) {
      const allowed = trackIds.filter((id) => !isExtra(id));
      const dropped = new Set(trackIds.filter(isExtra)).size;
      if (dropped && !silent) toast(t('local.notInPlaylists', { count: dropped }));
      return { allowed, nothingLeft: dropped > 0 && allowed.length === 0 };
    },
  };
}

/** Local copy first (instant start, works offline), then revalidate with the home. */
async function loadLibrary({ set, get }: LibraryCtx) {
  if (get().loading) return;
  set({ loading: true, error: null });
  const cached = await kvGet<CachedLibrary>(cacheKey());
  if (cached && !get().loaded) {
    set({ ...(await fromSnapshotWithExtras(cached.library)), loaded: true });
  }
  try {
    const fresh = await withTimeout(getHome().load(cached?.etag || undefined), LOAD_TIMEOUT_MS);
    if (fresh) {
      const { etag, ...library } = fresh;
      set({ ...(await fromSnapshotWithExtras(library)), loaded: true });
      await kvSet(cacheKey(), { etag, library, savedAt: Date.now() } satisfies CachedLibrary);
    }
    set({ loading: false, loaded: true });
  } catch (err) {
    if (isTimeout(err)) useConnectivity.getState().reportTrouble();
    set({
      loading: false,
      loaded: get().loaded || !!cached,
      error: cached ? null : err instanceof Error ? err.message : 'error',
    });
  }
}

export const useLibrary = create<LibraryState>((set, get) => {
  const ctx = createContext(set, get);
  return {
    loaded: false,
    loading: false,
    error: null,
    tracks: {},
    order: [],
    playlists: [],
    folders: [],
    load: () => loadLibrary(ctx),
    ...createTrackActions(ctx),
    ...createPlaylistActions(ctx),
    ...createFolderActions(ctx),
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
