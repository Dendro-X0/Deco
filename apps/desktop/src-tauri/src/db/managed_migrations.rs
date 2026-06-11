use chrono::Utc;
use rusqlite::{params, Connection};
use serde::Serialize;
use uuid::Uuid;

use crate::util::tool_migration::{MigrationResult, ToolId};

#[derive(Debug, Clone, Serialize)]
pub struct ManagedMigrationEntry {
    pub id: String,
    pub tool: String,
    pub source_path: String,
    pub dest_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leg: Option<String>,
    pub migrated_at: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audit_log_path: Option<String>,
    pub discovered: bool,
}

pub fn record_from_result(conn: &Connection, result: &MigrationResult) -> Result<(), String> {
    if !result.ok {
        return Ok(());
    }
    let migrated_at = Utc::now().to_rfc3339();
    if let Some(legs) = &result.legs {
        for leg in legs {
            if !leg.ok || leg.skipped == Some(true) {
                continue;
            }
            upsert_row(
                conn,
                &result.tool,
                &leg.source,
                &leg.dest,
                Some(leg.leg.as_str()),
                &migrated_at,
                result.audit_log_path.as_deref(),
                false,
            )?;
        }
        return Ok(());
    }
    upsert_row(
        conn,
        &result.tool,
        &result.source,
        &result.dest,
        None,
        &migrated_at,
        result.audit_log_path.as_deref(),
        false,
    )
}

fn upsert_row(
    conn: &Connection,
    tool: &str,
    source_path: &str,
    dest_path: &str,
    leg: Option<&str>,
    migrated_at: &str,
    audit_log_path: Option<&str>,
    discovered: bool,
) -> Result<(), String> {
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM managed_migrations WHERE source_path = ?1",
            params![source_path],
            |row| row.get(0),
        )
        .ok();
    let id = existing.unwrap_or_else(|| Uuid::new_v4().to_string());
    conn.execute(
        "INSERT INTO managed_migrations (id, tool, source_path, dest_path, leg, migrated_at, audit_log_path, discovered)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(source_path) DO UPDATE SET
           tool = excluded.tool,
           dest_path = excluded.dest_path,
           leg = excluded.leg,
           migrated_at = excluded.migrated_at,
           audit_log_path = COALESCE(excluded.audit_log_path, managed_migrations.audit_log_path),
           discovered = MIN(managed_migrations.discovered, excluded.discovered)",
        params![
            id,
            tool,
            source_path,
            dest_path,
            leg,
            migrated_at,
            audit_log_path,
            if discovered { 1 } else { 0 },
        ],
    )
    .map_err(|e| format!("failed recording managed migration: {e}"))?;
    Ok(())
}

pub fn list(conn: &Connection) -> Result<Vec<ManagedMigrationEntry>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, tool, source_path, dest_path, leg, migrated_at, audit_log_path, discovered
             FROM managed_migrations
             ORDER BY migrated_at DESC",
        )
        .map_err(|e| format!("failed preparing managed migrations query: {e}"))?;
    let rows = stmt
        .query_map([], |row| {
            Ok(ManagedMigrationEntry {
                id: row.get(0)?,
                tool: row.get(1)?,
                source_path: row.get(2)?,
                dest_path: row.get(3)?,
                leg: row.get(4)?,
                migrated_at: row.get(5)?,
                audit_log_path: row.get(6)?,
                discovered: row.get::<_, i64>(7)? != 0,
            })
        })
        .map_err(|e| format!("failed listing managed migrations: {e}"))?;
    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("failed reading managed migrations: {e}"))
}

pub fn remove(conn: &Connection, id: &str) -> Result<bool, String> {
    let n = conn
        .execute("DELETE FROM managed_migrations WHERE id = ?1", params![id.trim()])
        .map_err(|e| format!("failed removing managed migration: {e}"))?;
    Ok(n > 0)
}

#[cfg(windows)]
pub fn sync_discovered_junctions(conn: &Connection) -> Result<u32, String> {
    use crate::util::windows_profile_paths::{check_migrate_source_dir, junction_target, SourceDirCheck};

    let mut added = 0u32;
    let migrated_at = Utc::now().to_rfc3339();

    for tool in discovery_tool_ids() {
        let source = match crate::util::tool_migration::default_source_for_discovery(&tool) {
            Ok(p) => p,
            Err(_) => continue,
        };
        if check_migrate_source_dir(&source) != SourceDirCheck::AlreadyLink {
            continue;
        }
        let Some(target) = junction_target(&source) else {
            continue;
        };
        let source_s = source.to_string_lossy().to_string();
        let before: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM managed_migrations WHERE source_path = ?1",
                params![&source_s],
                |row| row.get(0),
            )
            .unwrap_or(0);
        upsert_row(
            conn,
            tool.wire(),
            &source_s,
            &target.to_string_lossy(),
            discovery_leg_label(&tool),
            &migrated_at,
            None,
            true,
        )?;
        if before == 0 {
            added += 1;
        }
    }

    Ok(added)
}

#[cfg(not(windows))]
pub fn sync_discovered_junctions(_conn: &Connection) -> Result<u32, String> {
    Ok(0)
}

#[cfg(windows)]
fn discovery_tool_ids() -> Vec<ToolId> {
    use ToolId::*;
    vec![
        CursorRoaming,
        CursorLocal,
        Vscode,
        ClaudeCode,
        CodexCli,
        GoogleChrome,
        MicrosoftEdge,
        Brave,
        DiscordRoaming,
        DiscordLocal,
        Spotify,
        Slack,
        Telegram,
        Notion,
        ObsStudio,
    ]
}

#[cfg(windows)]
fn discovery_leg_label(tool: &ToolId) -> Option<&'static str> {
    match tool {
        ToolId::CursorRoaming | ToolId::DiscordRoaming => Some("roaming"),
        ToolId::CursorLocal | ToolId::DiscordLocal => Some("local"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;
    use crate::util::tool_migration::MigrationResult;
    use uuid::Uuid;

    #[test]
    fn record_and_list_managed_migration() {
        let dir = std::env::temp_dir().join(format!("deco-managed-mig-{}", Uuid::new_v4()));
        let db_path = dir.join("deco.db");
        let conn = init_db(&db_path).expect("init db");
        let result = MigrationResult {
            ok: true,
            tool: "cursor".to_string(),
            source: r"C:\Users\me\AppData\Roaming\Cursor".to_string(),
            dest: r"G:\DevToolData\Cursor".to_string(),
            audit_log_path: Some(r"C:\Temp\audit.json".to_string()),
            backup_path: None,
            warnings: vec![],
            errors: vec![],
            legs: None,
            pending_backups: None,
            copy_completed: None,
            manual_finish_steps: None,
        };
        record_from_result(&conn, &result).expect("record");
        let rows = list(&conn).expect("list");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].tool, "cursor");
        assert!(!rows[0].discovered);
        let _ = std::fs::remove_dir_all(dir);
    }
}
