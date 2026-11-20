CREATE TABLE shared_lists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  songs_json TEXT NOT NULL,
  delete_key_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX shared_lists_expires ON shared_lists (expires_at);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
