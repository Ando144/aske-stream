/**
 * Domain types shared across the monorepo.
 *
 * The API serialises exactly these shapes, the web app consumes them and the
 * ingest CLI produces {@link IngestMetadata}. Keeping them in one package means
 * a schema change is a compile error everywhere at once.
 */

/** Unix epoch in milliseconds. */
export type EpochMs = number;

export type TrackSource = 'youtube' | 'file';

/** Music goes to the library; podcasts (talk, long videos) get their own section. */
export type TrackKind = 'music' | 'podcast';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  sizeBytes: number;
  bitrateKbps: number | null;
  hasCover: boolean;
  kind: TrackKind;
  source: TrackSource | null;
  /** Origin identifier, e.g. the YouTube video id. Used to avoid duplicates. */
  sourceRef: string | null;
  /** `null` when the track is not in "Liked songs". */
  likedAt: EpochMs | null;
  createdAt: EpochMs;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  /** Ordered track ids. */
  trackIds: string[];
  createdAt: EpochMs;
  updatedAt: EpochMs;
  /** Folder that holds it; null/undefined = top level. */
  folderId?: string | null;
  /** When the custom cover was set; null/undefined = automatic mosaic. */
  coverAt?: EpochMs | null;
  /** Google Drive only: file id of the custom cover. */
  coverFileId?: string | null;
}

/** A single-level folder that only holds playlists. */
export interface Folder {
  id: string;
  name: string;
  createdAt: EpochMs;
  updatedAt: EpochMs;
  /** Order chosen by the user (ascending). null/undefined = not ordered yet. */
  position?: number | null;
}

export { sortFolders, nextFolderPosition, reorderFolders, type FolderReorder } from './folders';

/** Full snapshot returned by `GET /api/library`. Small enough for one user. */
export interface Library {
  /** Monotonic counter bumped on every write; doubles as the HTTP ETag. */
  version: number;
  tracks: Track[];
  playlists: Playlist[];
  folders: Folder[];
}

/** A radio station saved in the user's own list (liked from the catalog or added by URL). */
export interface Station {
  id: string;
  /** Radio Browser `stationuuid`, `null` for stations added by hand. */
  rbUuid: string | null;
  name: string;
  streamUrl: string;
  homepage: string;
  favicon: string;
  countryCode: string;
  tags: string[];
  codec: string;
  bitrate: number;
  hls: boolean;
  isCustom: boolean;
  likedAt: EpochMs | null;
  createdAt: EpochMs;
}

/** A station as returned by the catalog proxy (Radio Browser). */
export interface CatalogStation {
  rbUuid: string;
  name: string;
  streamUrl: string;
  homepage: string;
  favicon: string;
  countryCode: string;
  tags: string[];
  codec: string;
  bitrate: number;
  hls: boolean;
  votes: number;
  clickCount: number;
}

export interface CatalogTag {
  name: string;
  stationCount: number;
}

export interface CatalogCountry {
  code: string;
  name: string;
  stationCount: number;
}

/** Metadata sent by the ingest CLI together with the audio file. */
export interface IngestMetadata {
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  bitrateKbps: number | null;
  source: TrackSource;
  sourceRef: string | null;
  kind?: TrackKind;
}

export interface ApiError {
  error: string;
  message: string;
}

/** A song or playlist sent from the computer for the phone to download. */
export interface SendItem {
  id: string;
  url: string;
  kind: 'video' | 'playlist';
  title: string;
  author: string;
  thumbnail: string;
  status: 'pending' | 'taken' | 'done' | 'error';
  detail: string;
  createdAt: number;
  updatedAt: number;
}

/** How full the owner's Cloudflare storage is. */
export interface StorageStats {
  trackCount: number;
  /** Audio + estimated covers, in bytes. */
  usedBytes: number;
  /** The budget (10 GB by default: R2's free allowance). */
  limitBytes: number;
  /** Uploads stop here (a little below the budget, to stay free). */
  uploadLimitBytes: number;
}

/** Shared validation limits so the UI and the API agree. */
export const LIMITS = {
  titleMax: 300,
  nameMax: 120,
  descriptionMax: 500,
  /** Most songs a playlist can hold (also the most sent in one request). */
  playlistMaxTracks: 1000,
  audioMaxBytes: 95 * 1024 * 1024,
  coverMaxBytes: 2 * 1024 * 1024,
  playlistCoverPx: 300,
  urlMax: 2048,
} as const;

export const SESSION_COOKIE = 'aske_session';
