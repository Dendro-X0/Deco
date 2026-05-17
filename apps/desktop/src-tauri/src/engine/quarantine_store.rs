use super::types::QuarantineEntry;
use super::types::Settings;
use crate::util::volume::volume_root;
use chrono::Utc;
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};
use uuid::Uuid;

const VOLUME_QUARANTINE_DIR: &str = ".deco-quarantine";

/// Where quarantined payloads are stored on disk (never defaults to `%AppData%`).
#[derive(Debug, Clone)]
pub struct QuarantineStorage {
    layout: QuarantineLayoutKind,
    custom_base: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum QuarantineLayoutKind {
    PerSourceDrive,
    CustomBase,
}

impl QuarantineStorage {
    pub fn from_settings(settings: &Settings) -> Self {
        let trimmed = settings.quarantine_custom_path.trim();
        if settings.quarantine_layout == "custom" && !trimmed.is_empty() {
            Self {
                layout: QuarantineLayoutKind::CustomBase,
                custom_base: Some(PathBuf::from(trimmed)),
            }
        } else {
            Self {
                layout: QuarantineLayoutKind::PerSourceDrive,
                custom_base: None,
            }
        }
    }

    #[cfg(test)]
    pub fn per_source_drive() -> Self {
        Self {
            layout: QuarantineLayoutKind::PerSourceDrive,
            custom_base: None,
        }
    }

    fn resolve_root(&self, original_path: &str) -> Result<PathBuf, String> {
        match self.layout {
            QuarantineLayoutKind::CustomBase => {
                self.custom_base.clone().ok_or_else(|| {
                    "Custom quarantine folder is not set. Choose a folder in Settings → Quarantine storage."
                        .to_string()
                })
            }
            QuarantineLayoutKind::PerSourceDrive => volume_root(Path::new(original_path))
                .map(|vol| vol.join(VOLUME_QUARANTINE_DIR))
                .ok_or_else(|| {
                    format!(
                        "Could not determine drive for quarantine of {original_path}. \
                         Set a custom quarantine folder in Settings, or use Delete in place mode."
                    )
                }),
        }
    }
}

pub fn quarantine_item_path(
    storage: &QuarantineStorage,
    id: &str,
    original_path: &str,
) -> Result<PathBuf, String> {
    let name = Path::new(original_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "target".to_string());
    Ok(storage
        .resolve_root(original_path)?
        .join("items")
        .join(format!("{id}-{name}")))
}

pub fn add_quarantine_entry(
    conn: &Connection,
    original_path: &str,
    quarantined_path: &str,
    size_bytes: Option<u64>,
    reason_summary: String,
) -> Result<QuarantineEntry, String> {
    let id = Uuid::new_v4().to_string();
    let timestamp_iso = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO quarantine (id, original_path, quarantined_path, timestamp_iso, size_bytes, reason_summary) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            id,
            original_path,
            quarantined_path,
            timestamp_iso,
            size_bytes.map(|v| v as i64),
            reason_summary,
        ],
    )
    .map_err(|e| format!("failed to insert quarantine entry: {e}"))?;

    Ok(QuarantineEntry {
        id,
        original_path: original_path.to_string(),
        quarantined_path: quarantined_path.to_string(),
        timestamp_iso,
        size_bytes,
        reason_summary,
    })
}

pub fn list_quarantine_entries(conn: &Connection) -> Result<Vec<QuarantineEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, original_path, quarantined_path, timestamp_iso, size_bytes, reason_summary
             FROM quarantine WHERE restored_at IS NULL AND purged_at IS NULL ORDER BY timestamp_iso DESC",
        )
        .map_err(|e| format!("failed to prepare query: {e}"))?;

    let rows = stmt
        .query_map([], |row| {
            Ok(QuarantineEntry {
                id: row.get(0)?,
                original_path: row.get(1)?,
                quarantined_path: row.get(2)?,
                timestamp_iso: row.get(3)?,
                size_bytes: row.get::<_, Option<i64>>(4)?.map(|v| v as u64),
                reason_summary: row.get(5)?,
            })
        })
        .map_err(|e| format!("failed to query entries: {e}"))?;

    let mut entries = vec![];
    for row in rows {
        entries.push(row.map_err(|e| format!("failed mapping row: {e}"))?);
    }
    Ok(entries)
}

pub fn mark_restored(conn: &Connection, id: &str) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE quarantine SET restored_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| format!("failed updating restore state: {e}"))?;
    Ok(())
}

pub fn mark_purged(conn: &Connection, id: &str) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE quarantine SET purged_at = ?1 WHERE id = ?2",
        params![now, id],
    )
    .map_err(|e| format!("failed updating purge state: {e}"))?;
    Ok(())
}

pub fn get_entry_by_id(conn: &Connection, id: &str) -> Result<Option<QuarantineEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, original_path, quarantined_path, timestamp_iso, size_bytes, reason_summary
             FROM quarantine WHERE id = ?1 AND restored_at IS NULL AND purged_at IS NULL",
        )
        .map_err(|e| format!("failed to prepare id query: {e}"))?;

    let mut rows = stmt
        .query(params![id])
        .map_err(|e| format!("failed querying id: {e}"))?;

    if let Some(row) = rows
        .next()
        .map_err(|e| format!("failed reading row: {e}"))?
    {
        return Ok(Some(QuarantineEntry {
            id: row.get(0).map_err(|e| format!("id parse error: {e}"))?,
            original_path: row.get(1).map_err(|e| format!("path parse error: {e}"))?,
            quarantined_path: row.get(2).map_err(|e| format!("q path parse error: {e}"))?,
            timestamp_iso: row.get(3).map_err(|e| format!("time parse error: {e}"))?,
            size_bytes: row
                .get::<_, Option<i64>>(4)
                .map_err(|e| format!("size parse error: {e}"))?
                .map(|v| v as u64),
            reason_summary: row.get(5).map_err(|e| format!("reason parse error: {e}"))?,
        }));
    }

    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quarantine_item_on_source_drive_windows() {
        let storage = QuarantineStorage::per_source_drive();
        let q = quarantine_item_path(
            &storage,
            "c1",
            r"E:\repo\apps\desktop\src-tauri\target",
        )
        .expect("path");
        let s = q.to_string_lossy();
        assert!(s.contains(".deco-quarantine"), "expected volume quarantine dir, got {s}");
        assert!(
            s.starts_with("E:") || s.starts_with("e:"),
            "expected E: drive quarantine, got {s}"
        );
    }

    #[test]
    fn custom_base_ignores_source_drive() {
        let storage = QuarantineStorage {
            layout: QuarantineLayoutKind::CustomBase,
            custom_base: Some(PathBuf::from(r"D:\DecoQuarantine")),
        };
        let q = quarantine_item_path(&storage, "id1", r"C:\temp\target").expect("path");
        assert!(q.starts_with(r"D:\DecoQuarantine"));
    }
}
