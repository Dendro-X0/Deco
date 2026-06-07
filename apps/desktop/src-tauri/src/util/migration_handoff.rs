//! Low OS volume → migration candidate suggestions (v0.9.10, Windows).

use serde::Serialize;
use std::path::{Path, PathBuf};

use crate::engine::types::Settings;
use crate::util::storage_volumes::{list_storage_volumes, StorageVolume};
use crate::util::tool_migration::ToolId;
use crate::util::windows_profile_paths::{check_migrate_source_dir, SourceDirCheck};

pub const DEFAULT_MIN_FREE_PCT: u32 = 15;
pub const DEFAULT_MIN_FREE_GB: u32 = 20;
const GB: u64 = 1024 * 1024 * 1024;

#[derive(Debug, Clone, Serialize)]
pub struct MigrationHandoffCandidate {
    pub tool: String,
    pub source_path: String,
    pub bytes: Option<u64>,
    pub already_migrated: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct MigrationHandoffStatus {
    pub supported: bool,
    pub low_space: bool,
    pub system_mount: Option<String>,
    pub available_bytes: Option<u64>,
    pub total_bytes: Option<u64>,
    pub free_pct: Option<f64>,
    pub candidates: Vec<MigrationHandoffCandidate>,
    pub suggested_tool: Option<String>,
}

fn handoff_tool_ids() -> &'static [ToolId] {
    &[
        ToolId::Cursor,
        ToolId::Vscode,
        ToolId::ClaudeCode,
        ToolId::CodexCli,
        ToolId::Discord,
        ToolId::GoogleChrome,
        ToolId::MicrosoftEdge,
        ToolId::Brave,
        ToolId::Spotify,
        ToolId::Slack,
        ToolId::Telegram,
        ToolId::Notion,
        ToolId::ObsStudio,
    ]
}

fn pick_system_volume(volumes: &[StorageVolume]) -> Option<StorageVolume> {
    #[cfg(windows)]
    {
        if let Some(c) = volumes.iter().find(|v| v.mount_point.eq_ignore_ascii_case("C:\\")) {
            return Some(c.clone());
        }
    }
    volumes
        .iter()
        .find(|v| v.volume_kind == "fixed")
        .cloned()
        .or_else(|| volumes.first().cloned())
}

fn path_on_volume(path: &Path, mount: &str) -> bool {
    let p = path.to_string_lossy().to_lowercase();
    let m = mount.to_lowercase();
    p.starts_with(&m)
}

fn is_low_space(vol: &StorageVolume, settings: &Settings) -> bool {
    if vol.total_bytes == 0 {
        return false;
    }
    let min_pct = settings.migration_handoff_min_free_pct;
    let min_bytes = settings.migration_handoff_min_free_gb as u64 * GB;
    let pct = (vol.available_bytes as f64 / vol.total_bytes as f64) * 100.0;
    pct < min_pct as f64 || vol.available_bytes < min_bytes
}

#[cfg(windows)]
fn leg_sources(tool: ToolId) -> Vec<PathBuf> {
    if tool.is_bundle() {
        tool.bundle_members()
            .iter()
            .filter_map(|(_, member)| crate::util::tool_migration::default_source_for_discovery(member).ok())
            .collect()
    } else if tool.is_plan_only() {
        Vec::new()
    } else {
        crate::util::tool_migration::default_source_for_discovery(&tool)
            .ok()
            .into_iter()
            .collect()
    }
}

#[cfg(not(windows))]
fn leg_sources(_tool: ToolId) -> Vec<PathBuf> {
    Vec::new()
}

#[cfg(windows)]
fn estimate_dir_bytes(path: &Path) -> Option<u64> {
    if !path.is_dir() {
        return None;
    }
    let mut total = 0u64;
    for entry in walkdir::WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Ok(m) = entry.metadata() {
                total = total.saturating_add(m.len());
            }
        }
    }
    Some(total)
}

#[cfg(not(windows))]
fn estimate_dir_bytes(_path: &Path) -> Option<u64> {
    None
}

#[cfg(windows)]
fn evaluate_tool_candidate(tool: ToolId, system_mount: &str) -> Option<MigrationHandoffCandidate> {
    if tool.is_plan_only() {
        return None;
    }
    let sources = leg_sources(tool);
    if sources.is_empty() {
        return None;
    }

    let mut ready_on_system: Vec<PathBuf> = Vec::new();
    let mut migrated_on_system: Vec<PathBuf> = Vec::new();

    for source in &sources {
        if !path_on_volume(source, system_mount) {
            continue;
        }
        match check_migrate_source_dir(source) {
            SourceDirCheck::Ready => ready_on_system.push(source.clone()),
            SourceDirCheck::AlreadyLink => migrated_on_system.push(source.clone()),
            SourceDirCheck::NotFound | SourceDirCheck::NotDirectory | SourceDirCheck::Inaccessible => {}
        }
    }

    if ready_on_system.is_empty() && migrated_on_system.is_empty() {
        return None;
    }

    let already_migrated = ready_on_system.is_empty() && !migrated_on_system.is_empty();
    if already_migrated {
        return None;
    }

    let primary = ready_on_system.first()?.clone();
    let bytes = estimate_dir_bytes(&primary);
    for extra in ready_on_system.iter().skip(1) {
        if let Some(b) = estimate_dir_bytes(extra) {
            // accumulate for bundle display total
            let _ = b;
        }
    }
    let total_bytes = if ready_on_system.len() > 1 {
        Some(
            ready_on_system
                .iter()
                .filter_map(|p| estimate_dir_bytes(p))
                .sum(),
        )
    } else {
        bytes
    };

    Some(MigrationHandoffCandidate {
        tool: tool.wire().to_string(),
        source_path: primary.to_string_lossy().to_string(),
        bytes: total_bytes,
        already_migrated: false,
    })
}

#[cfg(not(windows))]
fn evaluate_tool_candidate(_tool: ToolId, _system_mount: &str) -> Option<MigrationHandoffCandidate> {
    None
}

pub fn migration_handoff_status(settings: &Settings) -> MigrationHandoffStatus {
    #[cfg(not(windows))]
    {
        return MigrationHandoffStatus {
            supported: false,
            low_space: false,
            system_mount: None,
            available_bytes: None,
            total_bytes: None,
            free_pct: None,
            candidates: vec![],
            suggested_tool: None,
        };
    }

    #[cfg(windows)]
    {
        if !settings.migration_handoff_enabled {
            return MigrationHandoffStatus {
                supported: true,
                low_space: false,
                system_mount: None,
                available_bytes: None,
                total_bytes: None,
                free_pct: None,
                candidates: vec![],
                suggested_tool: None,
            };
        }

        let volumes = list_storage_volumes();
        let Some(system) = pick_system_volume(&volumes) else {
            return MigrationHandoffStatus {
                supported: true,
                low_space: false,
                system_mount: None,
                available_bytes: None,
                total_bytes: None,
                free_pct: None,
                candidates: vec![],
                suggested_tool: None,
            };
        };

        let free_pct = if system.total_bytes > 0 {
            Some((system.available_bytes as f64 / system.total_bytes as f64) * 100.0)
        } else {
            None
        };
        let low = is_low_space(&system, settings);

        let mut candidates: Vec<MigrationHandoffCandidate> = Vec::new();
        if low {
            for tool in handoff_tool_ids() {
                if let Some(c) = evaluate_tool_candidate(*tool, &system.mount_point) {
                    candidates.push(c);
                }
            }
            candidates.sort_by(|a, b| b.bytes.unwrap_or(0).cmp(&a.bytes.unwrap_or(0)));
        }

        let suggested_tool = candidates.first().map(|c| c.tool.clone());

        MigrationHandoffStatus {
            supported: true,
            low_space: low,
            system_mount: Some(system.mount_point.clone()),
            available_bytes: Some(system.available_bytes),
            total_bytes: Some(system.total_bytes),
            free_pct,
            candidates,
            suggested_tool,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn low_space_triggers_on_pct_or_bytes() {
        let vol = StorageVolume {
            mount_point: "C:\\".to_string(),
            name: "C:".to_string(),
            total_bytes: 100 * GB,
            available_bytes: 10 * GB,
            used_bytes: 90 * GB,
            volume_kind: "fixed".to_string(),
        };
        let settings = Settings {
            migration_handoff_enabled: true,
            migration_handoff_min_free_pct: 15,
            migration_handoff_min_free_gb: 20,
            ..Settings::default()
        };
        assert!(is_low_space(&vol, &settings));
    }

    #[test]
    fn low_space_skips_when_plenty_free() {
        let vol = StorageVolume {
            mount_point: "C:\\".to_string(),
            name: "C:".to_string(),
            total_bytes: 100 * GB,
            available_bytes: 50 * GB,
            used_bytes: 50 * GB,
            volume_kind: "fixed".to_string(),
        };
        let settings = Settings::default();
        assert!(!is_low_space(&vol, &settings));
    }
}
