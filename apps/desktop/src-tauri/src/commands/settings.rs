use crate::engine::types::Settings;
use crate::state::AppState;
use crate::util::scan_roots::{effective_scan_roots, suggest_scan_roots, ScanScope};
use crate::util::storage_volumes::{list_storage_volumes, StorageVolume};
use rusqlite::params;
use std::sync::Arc;
use tauri::State;

fn persist_settings(conn: &rusqlite::Connection, settings: &Settings) -> Result<(), String> {
    let json = serde_json::to_string(settings)
        .map_err(|e| format!("failed serializing settings: {e}"))?;
    conn.execute(
        "INSERT INTO settings(key, value_json) VALUES ('app', ?1)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
        params![json],
    )
    .map_err(|e| format!("failed saving settings: {e}"))?;
    Ok(())
}

fn ensure_scan_roots(settings: &mut Settings) {
    // Do not auto-select partitions — the user must choose drives in the UI.
    if settings.roots.is_empty() && !settings.selected_volumes.is_empty() {
        settings.roots = effective_scan_roots(settings);
    }
}

#[tauri::command]
pub fn list_storage_volumes_command() -> Result<Vec<StorageVolume>, String> {
    Ok(list_storage_volumes())
}

#[tauri::command]
pub fn suggest_scan_roots_command(scope: Option<String>) -> Result<Vec<String>, String> {
    let scope = ScanScope::parse(scope.as_deref().unwrap_or("all"));
    Ok(suggest_scan_roots(scope))
}

#[tauri::command]
pub fn get_settings(state: State<Arc<AppState>>) -> Result<Settings, String> {
    let from_db = {
        let conn = state
            .db
            .lock()
            .map_err(|_| "db mutex poisoned".to_string())?;

        let mut stmt = conn
            .prepare("SELECT value_json FROM settings WHERE key = 'app' LIMIT 1")
            .map_err(|e| format!("failed preparing settings query: {e}"))?;

        let mut rows = stmt
            .query([])
            .map_err(|e| format!("failed querying settings: {e}"))?;

        if let Some(row) = rows
            .next()
            .map_err(|e| format!("failed iterating settings rows: {e}"))?
        {
            let json: String = row
                .get(0)
                .map_err(|e| format!("failed reading settings row: {e}"))?;
            Some(
                serde_json::from_str::<Settings>(&json)
                    .map_err(|e| format!("failed parsing settings json: {e}"))?,
            )
        } else {
            None
        }
    };

    let had_db_row = from_db.is_some();
    let roots_were_empty = from_db
        .as_ref()
        .map(|s| s.roots.is_empty())
        .unwrap_or(true);
    let mut settings = from_db.unwrap_or_default();

    ensure_scan_roots(&mut settings);

    let should_persist = !had_db_row || (roots_were_empty && !settings.roots.is_empty());

    {
        let mut guard = state
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_string())?;
        *guard = settings.clone();
    }

    if should_persist {
        let conn = state
            .db
            .lock()
            .map_err(|_| "db mutex poisoned".to_string())?;
        persist_settings(&conn, &settings)?;
    }

    Ok(settings)
}

#[tauri::command]
pub fn save_settings(settings: Settings, state: State<Arc<AppState>>) -> Result<(), String> {
    let mut settings = settings;
    if settings.default_target_gb == 0 {
        settings.default_target_gb = 10;
    }
    if settings.delete_mode == "hard-delete" && !settings.advanced_mode {
        settings.delete_mode = "quarantine".to_string();
    }

    {
        let mut guard = state
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_string())?;
        *guard = settings.clone();
    }

    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;

    persist_settings(&conn, &settings)?;

    Ok(())
}
