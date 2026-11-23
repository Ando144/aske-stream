-- Friend groups. No email, no IP, no music: an alias and the hash of a random device key.
CREATE TABLE groups (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, invite_code TEXT NOT NULL UNIQUE,
  owner_member_id TEXT NOT NULL, created_at INTEGER NOT NULL, last_active_at INTEGER NOT NULL);
CREATE INDEX groups_active ON groups (last_active_at);
CREATE TABLE group_members (
  group_id TEXT NOT NULL, member_id TEXT NOT NULL, device_hash TEXT NOT NULL,
  alias TEXT NOT NULL, joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, member_id), UNIQUE (group_id, device_hash));
CREATE INDEX group_members_device ON group_members (device_hash);
CREATE TABLE group_bans (group_id TEXT NOT NULL, device_hash TEXT NOT NULL,
  PRIMARY KEY (group_id, device_hash));
CREATE TABLE device_stats (device_hash TEXT NOT NULL, month TEXT NOT NULL,
  stats_json TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY (device_hash, month));
-- Up to 12 months per device; the hourly cleanup drops older months by this index.
CREATE INDEX device_stats_month ON device_stats (month);
CREATE TABLE group_shares (
  id TEXT PRIMARY KEY, group_id TEXT NOT NULL, member_id TEXT NOT NULL, kind TEXT NOT NULL,
  ref TEXT NOT NULL, title TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX group_shares_group ON group_shares (group_id, created_at);
