use crate::engine::quarantine_store::{
    get_entry_by_id, list_quarantine_entries, mark_purged, mark_restored,
};
use crate::engine::types::{
    BulkRestoreResponse, PurgeResponse, QuarantineEntry, QuarantineFilterRequest,
};
use crate::state::AppState;
use chrono::{Duration, Utc};
use std::path::Path;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn list_quarantine(state: State<Arc<AppState>>) -> Result<Vec<QuarantineEntry>, String> {
    list_quarantine_core(state.inner())
}

#[tauri::command]
pub fn list_quarantine_filtered(
    filter: QuarantineFilterRequest,
    state: State<Arc<AppState>>,
) -> Result<Vec<QuarantineEntry>, String> {
    let entries = list_quarantine_core(state.inner())?;
    let now = Utc::now();
    let query = filter.query.unwrap_or_default().to_lowercase();
    let from = filter
        .from_iso
        .as_ref()
        .and_then(|v| chrono::DateTime::parse_from_rfc3339(v).ok())
        .map(|v| v.with_timezone(&Utc));
    let to = filter
        .to_iso
        .as_ref()
        .and_then(|v| chrono::DateTime::parse_from_rfc3339(v).ok())
        .map(|v| v.with_timezone(&Utc));
    let only_purge_eligible = filter.only_purge_eligible.unwrap_or(false);
    let retention_days = filter.retention_days.unwrap_or(30);

    Ok(entries
        .into_iter()
        .filter(|entry| {
            let matches_query = query.is_empty()
                || entry.id.to_lowercase().contains(&query)
                || entry.original_path.to_lowercase().contains(&query)
                || entry.quarantined_path.to_lowercase().contains(&query);

            if !matches_query {
                return false;
            }

            let ts = chrono::DateTime::parse_from_rfc3339(&entry.timestamp_iso)
                .map(|t| t.with_timezone(&Utc))
                .unwrap_or(now);

            if let Some(from_ts) = from {
                if ts < from_ts {
                    return false;
                }
            }
            if let Some(to_ts) = to {
                if ts > to_ts {
                    return false;
                }
            }

            if only_purge_eligible {
                let cutoff = now - Duration::days(retention_days as i64);
                ts <= cutoff
            } else {
                true
            }
        })
        .collect())
}

pub(crate) fn list_quarantine_core(state: &AppState) -> Result<Vec<QuarantineEntry>, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;
    list_quarantine_entries(&conn)
}

#[tauri::command]
pub fn restore_quarantine(id: String, state: State<Arc<AppState>>) -> Result<String, String> {
    restore_quarantine_core(id, state.inner())
}

#[tauri::command]
pub fn restore_quarantine_bulk(
    ids: Vec<String>,
    state: State<Arc<AppState>>,
) -> Result<BulkRestoreResponse, String> {
    restore_quarantine_bulk_core(ids, state.inner())
}

pub(crate) fn restore_quarantine_bulk_core(
    ids: Vec<String>,
    state: &AppState,
) -> Result<BulkRestoreResponse, String> {
    let mut restored_paths = Vec::new();
    let mut failed_ids = Vec::new();
    let mut errors = Vec::new();

    for id in ids {
        match restore_quarantine_core(id.clone(), state) {
            Ok(path) => restored_paths.push(path),
            Err(e) => {
                failed_ids.push(id);
                errors.push(e);
            }
        }
    }

    Ok(BulkRestoreResponse {
        restored_count: restored_paths.len() as u32,
        restored_paths,
        failed_ids,
        errors,
    })
}

pub(crate) fn restore_quarantine_core(id: String, state: &AppState) -> Result<String, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;
    let entry =
        get_entry_by_id(&conn, &id)?.ok_or_else(|| format!("quarantine entry not found: {id}"))?;

    if let Some(parent) = Path::new(&entry.original_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed creating restore parent: {e}"))?;
    }

    std::fs::rename(&entry.quarantined_path, &entry.original_path)
        .or_else(|_| {
            if Path::new(&entry.quarantined_path).is_dir() {
                copy_dir_all(
                    Path::new(&entry.quarantined_path),
                    Path::new(&entry.original_path),
                )?;
                std::fs::remove_dir_all(&entry.quarantined_path)
            } else {
                std::fs::copy(&entry.quarantined_path, &entry.original_path).map(|_| ())?;
                std::fs::remove_file(&entry.quarantined_path)
            }
        })
        .map_err(|e| format!("failed restoring entry: {e}"))?;

    mark_restored(&conn, &id)?;
    Ok(entry.original_path)
}

#[tauri::command]
pub fn purge_quarantine(
    retention_days: u32,
    state: State<Arc<AppState>>,
) -> Result<PurgeResponse, String> {
    purge_quarantine_core(retention_days, state.inner())
}

pub(crate) fn purge_quarantine_core(
    retention_days: u32,
    state: &AppState,
) -> Result<PurgeResponse, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;
    let entries = list_quarantine_entries(&conn)?;

    let cutoff = Utc::now() - Duration::days(retention_days as i64);

    let mut purged_count = 0u32;
    let mut errors = vec![];

    for entry in entries {
        let timestamp = chrono::DateTime::parse_from_rfc3339(&entry.timestamp_iso)
            .map(|t| t.with_timezone(&Utc))
            .unwrap_or(Utc::now());

        if timestamp > cutoff {
            continue;
        }

        let path = Path::new(&entry.quarantined_path);
        let result = if path.is_dir() {
            std::fs::remove_dir_all(path)
        } else {
            std::fs::remove_file(path)
        };

        match result {
            Ok(_) => {
                purged_count += 1;
                let _ = mark_purged(&conn, &entry.id);
            }
            Err(e) => errors.push(format!("Failed purging {}: {}", entry.quarantined_path, e)),
        }
    }

    Ok(PurgeResponse {
        purged_count,
        errors,
    })
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), std::io::Error> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            std::fs::copy(entry.path(), dst.join(entry.file_name()))?;
        }
    }
    Ok(())
}
