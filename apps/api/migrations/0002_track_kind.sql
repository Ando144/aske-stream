-- v2: podcasts get their own section.
ALTER TABLE tracks ADD COLUMN kind TEXT NOT NULL DEFAULT 'music' CHECK (kind IN ('music', 'podcast'));
CREATE INDEX idx_tracks_kind ON tracks (kind);
