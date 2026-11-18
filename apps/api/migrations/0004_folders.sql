-- Single-level folders that group playlists, and optional custom playlist covers.
-- No foreign key on playlists.folder_id: ALTER TABLE ... REFERENCES is awkward in SQLite,
-- so the folder DELETE route clears folder_id itself.
CREATE TABLE folders (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

ALTER TABLE playlists ADD COLUMN folder_id TEXT;
ALTER TABLE playlists ADD COLUMN cover_at INTEGER;

CREATE INDEX idx_playlists_folder ON playlists (folder_id) WHERE folder_id IS NOT NULL;
