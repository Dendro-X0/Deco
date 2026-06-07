use crate::state::AppState;
use crate::util::migration_handoff::{self, MigrationHandoffStatus};
use crate::util::scan_root_warnings::{self, ScanRootWarning};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn migration_handoff_status(state: State<'_, Arc<AppState>>) -> Result<MigrationHandoffStatus, String> {
    let settings = state
        .settings
        .lock()
        .map_err(|e| format!("settings lock poisoned: {e}"))?;
    Ok(migration_handoff::migration_handoff_status(&settings))
}

#[tauri::command]
pub fn scan_roots_warnings(paths: Vec<String>) -> Result<Vec<ScanRootWarning>, String> {
    Ok(scan_root_warnings::scan_roots_warnings(&paths))
}
