CREATE TABLE IF NOT EXISTS scans (
  scan_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  roots_json TEXT NOT NULL,
  profile TEXT NOT NULL,
  stale_days INTEGER NOT NULL,
  scanned_dirs INTEGER NOT NULL,
  total_bytes INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS scan_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scan_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  phase TEXT NOT NULL,
  message TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS candidates (
  id TEXT PRIMARY KEY,
  scan_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  abs_path TEXT NOT NULL,
  size_bytes INTEGER,
  mtime_ms INTEGER,
  risk TEXT NOT NULL,
  safety_class TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  project_root TEXT,
  stale_days INTEGER
);

CREATE TABLE IF NOT EXISTS quarantine (
  id TEXT PRIMARY KEY,
  original_path TEXT NOT NULL,
  quarantined_path TEXT NOT NULL,
  timestamp_iso TEXT NOT NULL,
  size_bytes INTEGER,
  reason_summary TEXT NOT NULL,
  restored_at TEXT,
  purged_at TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_candidates_scan_id ON candidates(scan_id);
CREATE INDEX IF NOT EXISTS idx_quarantine_timestamp ON quarantine(timestamp_iso);
CREATE INDEX IF NOT EXISTS idx_quarantine_original_path ON quarantine(original_path);
CREATE INDEX IF NOT EXISTS idx_scans_created_at ON scans(created_at);
CREATE INDEX IF NOT EXISTS idx_scan_events_scan_id ON scan_events(scan_id);

-- v0.6.1: reuse classify/size for unchanged paths on quick update scans
CREATE TABLE IF NOT EXISTS path_inventory (
  abs_path TEXT NOT NULL,
  config_fingerprint TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  mtime_ms INTEGER,
  size_bytes INTEGER,
  risk TEXT NOT NULL,
  safety_class TEXT NOT NULL,
  reason_codes_json TEXT NOT NULL,
  project_root TEXT,
  stale_days INTEGER,
  can_delete INTEGER NOT NULL DEFAULT 1,
  display_reason_summary TEXT,
  last_scan_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (abs_path, config_fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_path_inventory_fingerprint ON path_inventory(config_fingerprint);

-- v0.9.9: Deco-managed directory junction migrations (Windows)
CREATE TABLE IF NOT EXISTS managed_migrations (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  source_path TEXT NOT NULL,
  dest_path TEXT NOT NULL,
  leg TEXT,
  migrated_at TEXT NOT NULL,
  audit_log_path TEXT,
  discovered INTEGER NOT NULL DEFAULT 0,
  UNIQUE(source_path)
);

CREATE INDEX IF NOT EXISTS idx_managed_migrations_migrated_at ON managed_migrations(migrated_at DESC);
