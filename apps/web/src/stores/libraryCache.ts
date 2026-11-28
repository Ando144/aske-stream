import { t } from '../i18n';
import { kvSet, type CachedLibrary } from '../offline/db';
import { mergeExtras } from '../storage/libraryMerge';
import {
  deleteLocalExtra,
  isOnlyOnDevice,
  listLocalExtras,
  updateLocalExtra,
} from '../storage/localExtras';
import type { LibraryHome, LibrarySnapshot, LocalTrack } from '../storage/types';
import type { LibraryState } from './libraryState';
import { useSetup } from './setup';
import { toast } from './ui';

/** One cache per home, so switching storage never mixes libraries. */
export const cacheKey = () => `library:${useSetup.getState().config?.home ?? 'none'}`;

function fromSnapshot(s: Omit<LibrarySnapshot, 'etag'>) {
  return {
    tracks: Object.fromEntries(s.tracks.map((tr) => [tr.id, tr])),
    order: s.tracks.map((tr) => tr.id),
    playlists: s.playlists,
    folders: s.folders ?? [],
  };
}

export const homeKind = () => useSetup.getState().config?.home;

export const extrasStore: Pick<LibraryHome, 'updateTrack' | 'deleteTrack'> = {
  updateTrack: updateLocalExtra,
  deleteTrack: deleteLocalExtra,
};

/** A broken local store must not hide the cloud library. */
export async function readExtras(): Promise<LocalTrack[]> {
  if (homeKind() === 'device') return [];
  try {
    return await listLocalExtras();
  } catch (err) {
    console.error('Could not read the songs kept only on this phone', err);
    toast(t('toast.error'), 'error');
    return [];
  }
}

export async function fromSnapshotWithExtras(s: Omit<LibrarySnapshot, 'etag'>) {
  return fromSnapshot({ ...s, tracks: mergeExtras(s.tracks, await readExtras()) });
}

/** Saves the in-memory state locally (with an empty ETag, so the next load revalidates). */
export async function persist(state: LibraryState, etag = '') {
  const library = {
    // Extras have their own store: caching them here would bring deleted ones back.
    tracks: state.order
      .map((id) => state.tracks[id]!)
      .filter((tr) => tr && !isOnlyOnDevice(tr, homeKind())),
    playlists: state.playlists,
    folders: state.folders,
  };
  await kvSet(cacheKey(), { etag, library, savedAt: Date.now() } satisfies CachedLibrary);
}
