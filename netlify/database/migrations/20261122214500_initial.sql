CREATE TABLE IF NOT EXISTS christmas_game (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS christmas_assignments (
  giver TEXT PRIMARY KEY,
  recipient TEXT NOT NULL UNIQUE,
  revealed_at TIMESTAMPTZ NULL,
  CHECK (giver <> recipient)
);
CREATE TABLE IF NOT EXISTS christmas_wishes (
  participant TEXT PRIMARY KEY,
  body TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
