-- Group photos: a small JPEG kept in D1. groups.photo_at versions it (NULL = no photo).
ALTER TABLE groups ADD COLUMN photo_at INTEGER;
CREATE TABLE group_photos (group_id TEXT PRIMARY KEY, data BLOB NOT NULL, updated_at INTEGER NOT NULL);
