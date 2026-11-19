import type { Folder, Playlist, Station, Track, TrackKind, TrackSource } from '@aske/shared';

/** Statement that marks the library as changed; append it to every write batch. */
export const bumpVersion = (db: D1Database) =>
  db.prepare(
    "UPDATE meta SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'library_version'",
  );

export async function getVersion(db: D1Database): Promise<number> {
  const row = await db
    .prepare("SELECT value FROM meta WHERE key = 'library_version'")
    .first<{ value: string }>();
  return Number(row?.value ?? 0);
}

export interface TrackRow {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  size_bytes: number;
  bitrate_kbps: number | null;
  mime: string;
  audio_key: string;
  cover_key: string | null;
  kind: TrackKind | null;
  source: TrackSource | null;
  source_ref: string | null;
  liked_at: number | null;
  created_at: number;
  updated_at: number;
}

export const toTrack = (r: TrackRow): Track => ({
  id: r.id,
  title: r.title,
  artist: r.artist,
  album: r.album,
  durationMs: r.duration_ms,
  sizeBytes: r.size_bytes,
  bitrateKbps: r.bitrate_kbps,
  hasCover: r.cover_key !== null,
  kind: r.kind ?? 'music',
  source: r.source,
  sourceRef: r.source_ref,
  likedAt: r.liked_at,
  createdAt: r.created_at,
});

export interface PlaylistRow {
  id: string;
  name: string;
  description: string;
  created_at: number;
  updated_at: number;
  folder_id: string | null;
  cover_at: number | null;
  position?: number | null;
  pinned_at?: number | null;
}

export const toPlaylist = (r: PlaylistRow, trackIds: string[]): Playlist => ({
  id: r.id,
  name: r.name,
  description: r.description,
  trackIds,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  folderId: r.folder_id ?? null,
  coverAt: r.cover_at ?? null,
  position: r.position ?? null,
  pinnedAt: r.pinned_at ?? null,
});

export interface FolderRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  position: number | null;
  pinned_at?: number | null;
}

export const toFolder = (r: FolderRow): Folder => ({
  id: r.id,
  name: r.name,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  position: r.position ?? null,
  pinnedAt: r.pinned_at ?? null,
});

export interface StationRow {
  id: string;
  rb_uuid: string | null;
  name: string;
  stream_url: string;
  homepage: string;
  favicon: string;
  country_code: string;
  tags: string;
  codec: string;
  bitrate: number;
  hls: number;
  is_custom: number;
  liked_at: number | null;
  created_at: number;
}

export const toStation = (r: StationRow): Station => ({
  id: r.id,
  rbUuid: r.rb_uuid,
  name: r.name,
  streamUrl: r.stream_url,
  homepage: r.homepage,
  favicon: r.favicon,
  countryCode: r.country_code,
  tags: r.tags ? r.tags.split(',').filter(Boolean) : [],
  codec: r.codec,
  bitrate: r.bitrate,
  hls: r.hls === 1,
  isCustom: r.is_custom === 1,
  likedAt: r.liked_at,
  createdAt: r.created_at,
});

/** R2 object keys are derived from the track id, so streaming needs no DB lookup. */
export const audioKey = (trackId: string) => `tracks/${trackId}/audio.opus`;
export const coverKey = (trackId: string) => `tracks/${trackId}/cover.jpg`;
export const playlistCoverKey = (playlistId: string) => `playlists/${playlistId}/cover.jpg`;
