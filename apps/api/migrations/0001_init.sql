-- aske-stream initial schema (Cloudflare D1 / SQLite).
-- Times are Unix epoch milliseconds. IDs are random URL-safe strings.

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Bumped on every library write; served as the ETag of GET /api/library.
INSERT INTO meta (key, value) VALUES ('library_version', '1');

CREATE TABLE tracks (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  artist       TEXT NOT NULL DEFAULT '',
  album        TEXT NOT NULL DEFAULT '',
  duration_ms  INTEGER NOT NULL CHECK (duration_ms > 0),
  size_bytes   INTEGER NOT NULL CHECK (size_bytes > 0),
  bitrate_kbps INTEGER,
  mime         TEXT NOT NULL DEFAULT 'audio/ogg',
  audio_key    TEXT NOT NULL,
  cover_key    TEXT,
  source       TEXT CHECK (source IN ('youtube', 'file')),
  source_ref   TEXT,
  liked_at     INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- The same YouTube video can only be ingested once.
CREATE UNIQUE INDEX idx_tracks_source_ref ON tracks (source, source_ref) WHERE source_ref IS NOT NULL;
CREATE INDEX idx_tracks_created ON tracks (created_at);
CREATE INDEX idx_tracks_liked ON tracks (liked_at) WHERE liked_at IS NOT NULL;

CREATE TABLE playlists (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE playlist_tracks (
  playlist_id TEXT NOT NULL REFERENCES playlists (id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL REFERENCES tracks (id) ON DELETE CASCADE,
  position    INTEGER NOT NULL,
  added_at    INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE INDEX idx_playlist_tracks_order ON playlist_tracks (playlist_id, position);
CREATE INDEX idx_playlist_tracks_track ON playlist_tracks (track_id);

-- "My stations": stations liked from the Radio Browser catalog plus custom URLs.
CREATE TABLE stations (
  id           TEXT PRIMARY KEY,
  rb_uuid      TEXT UNIQUE,
  name         TEXT NOT NULL,
  stream_url   TEXT NOT NULL,
  homepage     TEXT NOT NULL DEFAULT '',
  favicon      TEXT NOT NULL DEFAULT '',
  country_code TEXT NOT NULL DEFAULT '',
  tags         TEXT NOT NULL DEFAULT '',
  codec        TEXT NOT NULL DEFAULT '',
  bitrate      INTEGER NOT NULL DEFAULT 0,
  hls          INTEGER NOT NULL DEFAULT 0,
  is_custom    INTEGER NOT NULL DEFAULT 0,
  liked_at     INTEGER,
  created_at   INTEGER NOT NULL
);
