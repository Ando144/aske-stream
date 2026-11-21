-- "Send to phone" parcels: a short-lived list of YouTube songs. No IP, name or device is stored.
CREATE TABLE parcels (
  code TEXT PRIMARY KEY,
  songs_json TEXT NOT NULL,
  sender_key_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX parcels_expires ON parcels (expires_at);
