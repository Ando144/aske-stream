import type { Folder, Playlist, TrackKind } from '@aske/shared';
import type { StoreApi } from 'zustand';
import type { LibraryHome, LocalTrack } from '../storage/types';

export interface LibraryState {
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
  setKind: (trackId: string, kind: TrackKind) => Promise<void>;
  setKindMany: (trackIds: string[], kind: TrackKind) => Promise<void>;
  /** Moves episodes to a show (the show is stored in `album`). */
  setAlbumMany: (trackIds: string[], album: string) => Promise<void>;
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

/** What the action factories need from the store. */
export interface LibraryCtx {
  get: StoreApi<LibraryState>['getState'];
  set: StoreApi<LibraryState>['setState'];
  /** Applies an optimistic change, persists it, and rolls back on failure. */
  mutate: (
    change: (s: LibraryState) => Partial<LibraryState>,
    call: () => Promise<unknown>,
  ) => Promise<void>;
  replacePlaylist: (playlist: Playlist) => void;
  /** True for songs that exist only on this phone while the library lives in the cloud. */
  isExtra: (trackId: string) => boolean;
  /** Where the changes of one song are written. */
  storeFor: (trackId: string) => Pick<LibraryHome, 'updateTrack' | 'deleteTrack'>;
  /** Cloud playlists cannot hold songs that exist only on this phone. */
  forPlaylist: (
    trackIds: string[],
    silent?: boolean,
  ) => { allowed: string[]; nothingLeft: boolean };
  reload: () => Promise<void>;
}
