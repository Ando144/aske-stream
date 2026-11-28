ALTER TABLE tracks ADD COLUMN upload_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tracks_upload_id ON tracks(upload_id);
CREATE TABLE IF NOT EXISTS canceled_uploads (
  upload_id   TEXT PRIMARY KEY,
  canceled_at INTEGER NOT NULL
);
