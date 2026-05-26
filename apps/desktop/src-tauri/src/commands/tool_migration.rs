use crate::util::tool_migration::{self, MigrationPlan, MigrationResult, ToolId};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

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
        let wire = tool
            .as_deref()
            .map(ToolId::parse)
            .transpose()?
            .map(|t| t.wire().to_string())
            .unwrap_or_else(|| "custom".to_string());
        let plan_only = tool
            .as_deref()
            .and_then(|t| ToolId::parse(t).ok())
            .map(|id| matches!(id, ToolId::DockerDesktop))
            .unwrap_or(false);
        return Ok(tool_migration::plan_paths(&wire, src, dst, include_size, plan_only));
    }

    let tool = ToolId::parse(tool.as_deref().unwrap_or(""))?;
    let dest_root = dest_root
        .filter(|s| !s.trim().is_empty())
        .map(|s| PathBuf::from(s.trim()))
        .ok_or_else(|| "dest_root is required (or pass --source and --dest).".to_string())?;
    Ok(tool_migration::plan(tool, &dest_root, include_size))
}

#[tauri::command]
pub fn migrate_tool_dir_plan(
    tool: Option<String>,
    dest_root: Option<String>,
    source: Option<String>,
    dest: Option<String>,
    include_size: Option<bool>,
) -> Result<MigrationPlan, String> {
    resolve_plan(tool, dest_root, source, dest, include_size.unwrap_or(true))
}

#[tauri::command]
pub fn migrate_tool_dir_run(
    tool: Option<String>,
    dest_root: Option<String>,
    source: Option<String>,
    dest: Option<String>,
    copy_only: Option<bool>,
    app: AppHandle,
) -> Result<MigrationResult, String> {
    let plan = resolve_plan(
        tool,
        dest_root,
        source,
        dest,
        false,
    )?;
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("failed resolving app data dir: {e}"))?;
    let audit_dir = data_dir.join("migrations");
    Ok(tool_migration::run_from_plan(
        plan,
        copy_only.unwrap_or(false),
        &audit_dir,
    ))
}
