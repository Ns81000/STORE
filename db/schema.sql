-- STORE schema for Turso (libSQL / SQLite dialect).
-- Idempotent: safe to re-run. Mirrors the Postgres schema the app was built on,
-- minus Postgres-only GRANT/RLS statements. Foreign keys are declared for
-- integrity but the server code performs explicit cascade deletes in batches
-- rather than relying on the connection's foreign_keys pragma.

CREATE TABLE IF NOT EXISTS sections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color_token TEXT NOT NULL,
  svg_url TEXT,
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  section_id TEXT NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  icon_svg_url TEXT,
  preview_enabled INTEGER NOT NULL DEFAULT 0,
  action_mode TEXT NOT NULL DEFAULT 'open',
  sort_order INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS preview_cache (
  asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  og_title TEXT,
  og_description TEXT,
  og_image_url TEXT,
  og_site_name TEXT,
  status TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_hash TEXT NOT NULL,
  attempted_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS svg_library (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS asset_rows (
  id TEXT PRIMARY KEY,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  svg_url TEXT,
  label TEXT,
  url TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'open',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS assets_section_sort_idx ON assets (section_id, sort_order);
CREATE INDEX IF NOT EXISTS sections_sort_idx ON sections (sort_order);
CREATE INDEX IF NOT EXISTS login_attempts_ip_time_idx ON login_attempts (ip_hash, attempted_at);
CREATE INDEX IF NOT EXISTS asset_rows_asset_id_idx ON asset_rows (asset_id);
CREATE INDEX IF NOT EXISTS svg_library_sort_idx ON svg_library (sort_order);
