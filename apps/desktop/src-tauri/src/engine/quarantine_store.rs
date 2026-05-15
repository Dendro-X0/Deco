use super::types::QuarantineEntry;
use chrono::Utc;
use rusqlite::{params, Connection};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub fn quarantine_root(base_data_dir: &Path) -> PathBuf {
    base_data_dir.join("quarantine")
}

pub fn quarantine_item_path(base_data_dir: &Path, id: &str, original_path: &str) -> PathBuf {
    let name = Path::new(original_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "target".to_string());
    quarantine_root(base_data_dir)
        .join("items")
        .join(format!("{id}-{name}"))
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
