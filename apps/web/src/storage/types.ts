import type { Folder, Playlist, Station, Track } from '@aske/shared';

/** Where a library (metadata) or an audio file can live. */
export type Destination = 'device' | 'drive' | 'cloudflare';
export type HomeKind = Destination;

/** Where the audio of a song is stored. A song can be in several places. */
export interface TrackLocations {
  device?: true;
  /** Track id on the Cloudflare instance. */
  cloudflare?: string;
  /** Audio file id in Google Drive. */
  drive?: string;
  /** Cover file id in Google Drive. */
  driveCover?: string;
}

export interface LocalTrack extends Track {
  locations: TrackLocations;
  /** MIME type of the stored audio (Opus in Ogg/WebM, or the original format of imported files). */
  mime: string;
}

export interface LibrarySnapshot {
  tracks: LocalTrack[];
  playlists: Playlist[];
  /** Optional: copies cached by older versions have none. */
  folders?: Folder[];
  /** Opaque revalidation token (HTTP ETag for Cloudflare). */
  etag: string;
}

export type TrackPatch = Partial<Pick<Track, 'title' | 'artist' | 'album' | 'kind'>> & {
  liked?: boolean;
};
export type StationInput = Partial<Station> & { name: string; streamUrl: string; liked?: boolean };

/**
 * The *home* holds the library metadata (songs, playlists, likes, stations).
 * Each user has exactly one; audio files may live in several destinations.
 */
export interface LibraryHome {
  readonly kind: HomeKind;
  /** Returns `null` when the copy identified by `etag` is still current. */
  load(etag?: string): Promise<LibrarySnapshot | null>;
  updateTrack(id: string, patch: TrackPatch): Promise<LocalTrack>;
  deleteTrack(id: string): Promise<void>;
  createPlaylist(name: string, trackIds: string[]): Promise<Playlist>;
  renamePlaylist(id: string, name: string): Promise<Playlist>;
  deletePlaylist(id: string): Promise<void>;
  addToPlaylist(id: string, trackIds: string[]): Promise<Playlist>;
  removeFromPlaylist(id: string, trackId: string): Promise<Playlist>;
  /** New order; must contain the same songs. */
  reorderPlaylist(id: string, trackIds: string[]): Promise<Playlist>;
  createFolder(name: string): Promise<Folder>;
  renameFolder(id: string, name: string): Promise<Folder>;
  /** Its playlists go back to the top level; no playlist is deleted. */
  deleteFolder(id: string): Promise<void>;
  /** Saves the folder order. Folders not in `ids` go after. Returns all folders in the new order. */
  reorderFolders(ids: string[]): Promise<Folder[]>;
  /** folderId null = top level. Throws Error('folder_not_found') if the folder does not exist. */
  movePlaylist(id: string, folderId: string | null): Promise<Playlist>;
  /** jpeg: square JPEG already resized (≤ 300 px). null = back to the automatic mosaic. */
  setPlaylistCover(id: string, jpeg: Blob | null): Promise<Playlist>;
  // deletePlaylist(id) must also remove the custom cover, if any.
  listStations(): Promise<Station[]>;
  saveStation(station: StationInput): Promise<Station>;
  updateStation(id: string, patch: { liked?: boolean; name?: string }): Promise<Station>;
  deleteStation(id: string): Promise<void>;
}
