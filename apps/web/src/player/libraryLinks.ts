import type { usePlayer } from '../stores/player';
import { useLibrary } from '../stores/library';
import { setProtectedProvider } from '../stores/offline';
import { insertShuffled } from './shuffleCycle';

export interface LibraryLinkDeps {
  store: Pick<typeof usePlayer, 'getState' | 'setState'>;
  forgetTracks: (removed: Set<string>) => void;
  persist: () => void;
}

/** Deleting the playing song (or any queued one) must not leave the player on a ghost. */
function watchRemovals({ store, forgetTracks }: LibraryLinkDeps): void {
  useLibrary.subscribe((state, prev) => {
    if (state.tracks === prev.tracks) return;
    const removed = new Set(Object.keys(prev.tracks).filter((id) => !(id in state.tracks)));
    if (!removed.size) return;
    const p = store.getState();
    const used = [p.currentId, ...p.context, ...p.queue].some(
      (id) => id !== null && removed.has(id),
    );
    if (used) forgetTracks(removed);
  });
}

/** A live library list (shuffle or not) picks up songs added while it plays. */
function watchAdditions({ store, persist }: LibraryLinkDeps): void {
  useLibrary.subscribe((state, prev) => {
    if (state.order === prev.order) return;
    const p = store.getState();
    if (p.contextInfo?.live !== 'library' || !p.context.length) return;
    const known = new Set(p.original);
    const added = state.order.filter(
      (id) => !known.has(id) && state.tracks[id] && state.tracks[id]!.kind !== 'podcast',
    );
    if (!added.length) return;
    store.setState({
      original: [...p.original, ...added],
      context: p.contextShuffled
        ? insertShuffled(p.context, p.index, added)
        : [...p.context, ...added],
    });
    persist();
  });
}

/** Never rotate out the song that is playing or the one coming next. */
function protectPlayingSongs({ store }: LibraryLinkDeps): void {
  setProtectedProvider(() => {
    const s = store.getState();
    const ids = new Set<string>();
    if (s.mode === 'track') {
      if (s.currentId) ids.add(s.currentId);
      const nextId = s.queue[0] ?? s.context[s.index + 1];
      if (nextId) ids.add(nextId);
    }
    return ids;
  });
}

export function linkPlayerToLibrary(deps: LibraryLinkDeps): void {
  watchRemovals(deps);
  watchAdditions(deps);
  protectPlayingSongs(deps);
}
