import { t } from '../i18n';
import type { LocalTrack, TrackPatch } from '../storage/types';
import { persist } from './libraryCache';
import { reportError } from './libraryErrors';
import type { LibraryCtx, LibraryState } from './libraryState';
import { getHome } from './setup';
import { toast } from './ui';

/** Applies the same change to several songs; all of them roll back if one write fails. */
function updateMany(
  { mutate, storeFor }: LibraryCtx,
  ids: string[],
  changes: Partial<LocalTrack>,
  patch: TrackPatch,
) {
  return mutate(
    (s) => ({
      tracks: Object.fromEntries(
        Object.entries(s.tracks).map(([id, tr]) => [
          id,
          ids.includes(id) ? { ...tr, ...changes } : tr,
        ]),
      ),
    }),
    async () => {
      for (const id of ids) await storeFor(id).updateTrack(id, patch);
    },
  );
}

function createLikeActions(ctx: LibraryCtx): Pick<LibraryState, 'toggleLike' | 'likeMany'> {
  const { get, mutate, storeFor } = ctx;
  return {
    async toggleLike(trackId) {
      const track = get().tracks[trackId];
      if (!track) return;
      const liked = track.likedAt === null;
      await mutate(
        (s) => ({
          tracks: { ...s.tracks, [trackId]: { ...track, likedAt: liked ? Date.now() : null } },
        }),
        () => storeFor(trackId).updateTrack(trackId, { liked }),
      ).catch(() => undefined);
    },

    async likeMany(trackIds) {
      const todo = trackIds.filter((id) => get().tracks[id]?.likedAt === null);
      await updateMany(ctx, todo, { likedAt: Date.now() }, { liked: true })
        .then(() => toast(t('toast.likedMany', { count: trackIds.length })))
        .catch(() => undefined);
    },
  };
}

function createGroupingActions(
  ctx: LibraryCtx,
): Pick<LibraryState, 'setKind' | 'setKindMany' | 'setAlbumMany'> {
  const { get, mutate, storeFor } = ctx;
  return {
    async setKind(trackId, kind) {
      const track = get().tracks[trackId];
      if (!track) return;
      await mutate(
        (s) => ({ tracks: { ...s.tracks, [trackId]: { ...track, kind } } }),
        () => storeFor(trackId).updateTrack(trackId, { kind }),
      )
        .then(() =>
          toast(kind === 'podcast' ? t('toast.movedToPodcasts') : t('toast.movedToMusic')),
        )
        .catch(() => undefined);
    },

    async setKindMany(trackIds, kind) {
      const known = trackIds.filter((id) => get().tracks[id]);
      const todo = known.filter((id) => get().tracks[id]!.kind !== kind);
      await updateMany(ctx, todo, { kind }, { kind })
        .then(() =>
          toast(
            kind === 'podcast'
              ? t('toast.movedToPodcastsMany', { count: known.length })
              : t('toast.movedToMusic'),
          ),
        )
        .catch(() => undefined);
    },

    async setAlbumMany(trackIds, album) {
      const known = trackIds.filter((id) => get().tracks[id]);
      const todo = known.filter((id) => get().tracks[id]!.album !== album);
      await updateMany(ctx, todo, { album }, { album })
        .then(() => toast(t('podcasts.toast.showChanged', { count: known.length, name: album })))
        .catch(() => undefined);
    },
  };
}

function createListActions(
  ctx: LibraryCtx,
): Pick<LibraryState, 'upsertTracks' | 'reorderPlaylist' | 'deleteTrack'> {
  const { get, set, mutate, storeFor, forPlaylist, reload } = ctx;
  return {
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

    async reorderPlaylist(id, requested) {
      // An import may list songs that only exist on this phone.
      const { allowed: trackIds } = forPlaylist(requested, true);
      await mutate(
        (s) => ({ playlists: s.playlists.map((p) => (p.id === id ? { ...p, trackIds } : p)) }),
        () => getHome().reorderPlaylist(id, trackIds),
      ).catch(() => undefined);
    },

    async deleteTrack(trackId) {
      try {
        await storeFor(trackId).deleteTrack(trackId);
      } catch (err) {
        reportError(err, reload);
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
  };
}

export function createTrackActions(ctx: LibraryCtx) {
  return {
    ...createLikeActions(ctx),
    ...createGroupingActions(ctx),
    ...createListActions(ctx),
  };
}
