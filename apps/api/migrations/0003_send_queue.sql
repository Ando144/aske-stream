-- "Send to phone": songs and playlists picked on the computer, downloaded by the phone.
CREATE TABLE IF NOT EXISTS send_queue (
  id          TEXT PRIMARY KEY,
  url         TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('video', 'playlist')),
  title       TEXT NOT NULL DEFAULT '',
  author      TEXT NOT NULL DEFAULT '',
  thumbnail   TEXT NOT NULL DEFAULT '',
  -- pending: waiting for the phone · taken: the phone is downloading it
  -- done: in the library · error: see detail
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'taken', 'done', 'error')),
  detail      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS send_queue_by_status ON send_queue (status, created_at);
