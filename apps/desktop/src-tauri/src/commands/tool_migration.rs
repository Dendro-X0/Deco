use crate::db::managed_migrations::{self, ManagedMigrationEntry};
use crate::state::AppState;
use crate::util::tool_migration::{self, MigrationPlan, MigrationResult, ToolId};
use std::path::PathBuf;
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

fn resolve_plan(
    tool: Option<String>,
    dest_root: Option<String>,
    source: Option<String>,
    dest: Option<String>,
    include_size: bool,
) -> Result<MigrationPlan, String> {
    let explicit_source = source
        .filter(|s| !s.trim().is_empty())
        .map(|s| PathBuf::from(s.trim()));
    let explicit_dest = dest
        .filter(|s| !s.trim().is_empty())
        .map(|s| PathBuf::from(s.trim()));

    if explicit_source.is_some() || explicit_dest.is_some() {
        let src = explicit_source.ok_or_else(|| "Missing --source for custom migration.".to_string())?;
        let dst = explicit_dest.ok_or_else(|| "Missing --dest for custom migration.".to_string())?;
        let wire = match tool.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
            None | Some("custom") => "custom".to_string(),
            Some(other) => ToolId::parse(other)?.wire().to_string(),
        };
        let plan_only = tool
            .as_deref()
            .and_then(|t| ToolId::parse(t).ok())
            .map(|id| id.is_plan_only())
            .unwrap_or(false);
        return Ok(tool_migration::plan_paths(&wire, src, dst, include_size, plan_only));
    }

    let tool_str = tool.as_deref().unwrap_or("").trim();
    if tool_str.eq_ignore_ascii_case("custom") {
        return Err(
            "Custom migration requires --source and --dest (full folder paths).".to_string(),
        );
    }
    let tool = ToolId::parse(tool_str)?;
    let dest_root = dest_root
        .filter(|s| !s.trim().is_empty())
        .map(|s| PathBuf::from(s.trim()))
        .ok_or_else(|| "dest_root is required (or pass --source and --dest).".to_string())?;
    Ok(tool_migration::plan(tool, &dest_root, include_size))
}

#[tauri::command]
pub async fn migrate_tool_dir_plan(
    tool: Option<String>,
    dest_root: Option<String>,
    source: Option<String>,
    dest: Option<String>,
    include_size: Option<bool>,
) -> Result<MigrationPlan, String> {
    let include_size = include_size.unwrap_or(true);
    tauri::async_runtime::spawn_blocking(move || {
        resolve_plan(tool, dest_root, source, dest, include_size)
    })
    .await
    .map_err(|e| format!("migration plan task failed: {e}"))?
}

#[tauri::command]
pub async fn migrate_tool_dir_run(
    tool: Option<String>,
    dest_root: Option<String>,
    source: Option<String>,
    dest: Option<String>,
    copy_only: Option<bool>,
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
) -> Result<MigrationResult, String> {
    let copy_only = copy_only.unwrap_or(false);
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed resolving app data dir: {e}"))?;
    let audit_dir = data_dir.join("migrations");
    let state = state.inner().clone();

    tauri::async_runtime::spawn_blocking(move || -> Result<MigrationResult, String> {
        let plan = resolve_plan(tool, dest_root, source, dest, false)?;
        let result = tool_migration::run_from_plan(plan, copy_only, &audit_dir);
        // Custom folder assist only copies — junction is manual; do not register as managed migration.
        if result.ok && result.tool != "custom" {
            let conn = state
                .db
                .lock()
                .map_err(|e| format!("db lock poisoned: {e}"))?;
            managed_migrations::record_from_result(&conn, &result)?;
        }
        Ok(result)
    })
    .await
    .map_err(|e| format!("migration run task failed: {e}"))?
}

#[tauri::command]
pub async fn migrate_tool_dir_delete_backup(path: String) -> Result<u64, String> {
    tauri::async_runtime::spawn_blocking(move || {
        tool_migration::delete_migration_backup(PathBuf::from(path.trim()).as_path())
    })
    .await
    .map_err(|e| format!("delete backup task failed: {e}"))?
}

#[tauri::command]
pub async fn migrate_tool_dir_list_managed(
    sync_discovered: Option<bool>,
    state: State<'_, Arc<AppState>>,
) -> Result<Vec<ManagedMigrationEntry>, String> {
    let sync = sync_discovered.unwrap_or(true);
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("db lock poisoned: {e}"))?;
        if sync {
            let _ = managed_migrations::sync_discovered_junctions(&conn);
        }
        managed_migrations::list(&conn)
    })
    .await
    .map_err(|e| format!("list managed migrations failed: {e}"))?
}

#[tauri::command]
pub async fn migrate_tool_dir_remove_managed(
    id: String,
    state: State<'_, Arc<AppState>>,
) -> Result<bool, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || {
        let conn = state
            .db
            .lock()
            .map_err(|e| format!("db lock poisoned: {e}"))?;
        managed_migrations::remove(&conn, &id)
    })
    .await
    .map_err(|e| format!("remove managed migration failed: {e}"))?
}
