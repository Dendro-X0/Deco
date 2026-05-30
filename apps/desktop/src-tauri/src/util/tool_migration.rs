use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::process::Command;
use walkdir::WalkDir;

use crate::util::windows_profile_paths::user_profile_dir;

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ToolId {
    /// Roaming + LocalAppData bundle (one-click).
    Cursor,
    CursorRoaming,
    CursorLocal,
    Vscode,
    ClaudeCode,
    CodexCli,
    ClaudeDesktop,
    GoogleChrome,
    MicrosoftEdge,
    Brave,
    Firefox,
    Discord,
    DiscordRoaming,
    DiscordLocal,
    Spotify,
    Slack,
    Telegram,
    Notion,
    ObsStudio,
    EpicGames,
    SteamAppdata,
    BattleNet,
    DockerDesktop,
    NpmCache,
    PnpmStore,
}

impl ToolId {
    pub fn parse(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "cursor" => Ok(Self::Cursor),
            "cursor-roaming" => Ok(Self::CursorRoaming),
            "cursor-local" => Ok(Self::CursorLocal),
            "vscode" => Ok(Self::Vscode),
            "claude-code" => Ok(Self::ClaudeCode),
            "codex-cli" => Ok(Self::CodexCli),
            "claude-desktop" => Ok(Self::ClaudeDesktop),
            "google-chrome" => Ok(Self::GoogleChrome),
            "microsoft-edge" => Ok(Self::MicrosoftEdge),
            "brave" => Ok(Self::Brave),
            "firefox" => Ok(Self::Firefox),
            "discord" => Ok(Self::Discord),
            "discord-roaming" => Ok(Self::DiscordRoaming),
            "discord-local" => Ok(Self::DiscordLocal),
            "spotify" => Ok(Self::Spotify),
            "slack" => Ok(Self::Slack),
            "telegram" => Ok(Self::Telegram),
            "notion" => Ok(Self::Notion),
            "obs-studio" => Ok(Self::ObsStudio),
            "epic-games" => Ok(Self::EpicGames),
            "steam-appdata" => Ok(Self::SteamAppdata),
            "battle-net" => Ok(Self::BattleNet),
            "docker-desktop" => Ok(Self::DockerDesktop),
            "npm-cache" => Ok(Self::NpmCache),
            "pnpm-store" => Ok(Self::PnpmStore),
            other => Err(format!("unknown tool id: {other}")),
        }
    }

    pub fn wire(&self) -> &'static str {
        match self {
            ToolId::Cursor => "cursor",
            ToolId::CursorRoaming => "cursor-roaming",
            ToolId::CursorLocal => "cursor-local",
            ToolId::Vscode => "vscode",
            ToolId::ClaudeCode => "claude-code",
            ToolId::CodexCli => "codex-cli",
            ToolId::ClaudeDesktop => "claude-desktop",
            ToolId::GoogleChrome => "google-chrome",
            ToolId::MicrosoftEdge => "microsoft-edge",
            ToolId::Brave => "brave",
            ToolId::Firefox => "firefox",
            ToolId::Discord => "discord",
            ToolId::DiscordRoaming => "discord-roaming",
            ToolId::DiscordLocal => "discord-local",
            ToolId::Spotify => "spotify",
            ToolId::Slack => "slack",
            ToolId::Telegram => "telegram",
            ToolId::Notion => "notion",
            ToolId::ObsStudio => "obs-studio",
            ToolId::EpicGames => "epic-games",
            ToolId::SteamAppdata => "steam-appdata",
            ToolId::BattleNet => "battle-net",
            ToolId::DockerDesktop => "docker-desktop",
            ToolId::NpmCache => "npm-cache",
            ToolId::PnpmStore => "pnpm-store",
        }
    }

    pub fn is_plan_only(self) -> bool {
        matches!(
            self,
            ToolId::ClaudeDesktop
                | ToolId::Firefox
                | ToolId::EpicGames
                | ToolId::SteamAppdata
                | ToolId::BattleNet
                | ToolId::DockerDesktop
                | ToolId::NpmCache
                | ToolId::PnpmStore
        )
    }

    pub fn is_bundle(self) -> bool {
        matches!(self, ToolId::Cursor | ToolId::Discord)
    }

    pub fn bundle_members(self) -> &'static [(&'static str, ToolId)] {
        match self {
            ToolId::Cursor => &[("roaming", ToolId::CursorRoaming), ("local", ToolId::CursorLocal)],
            ToolId::Discord => {
                &[("roaming", ToolId::DiscordRoaming), ("local", ToolId::DiscordLocal)]
            }
            _ => &[],
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct MigrationPlanLeg {
    pub leg: String,
    pub source: String,
    pub dest: String,
    pub bytes: Option<u64>,
    pub file_count: Option<u64>,
    pub skipped: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MigrationPlan {
    pub ok: bool,
    pub tool: String,
    pub source: String,
    pub dest: String,
    pub bytes: Option<u64>,
    pub file_count: Option<u64>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    pub plan_only: bool,
    #[serde(default)]
    pub already_complete: bool,
    #[serde(default)]
    pub custom_mode: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legs: Option<Vec<MigrationPlanLeg>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub running_processes: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending_backups: Option<Vec<MigrationBackupEntry>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MigrationBackupEntry {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leg: Option<String>,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file_count: Option<u64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MigrationResultLeg {
    pub leg: String,
    pub ok: bool,
    pub source: String,
    pub dest: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub backup_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
pub struct MigrationResult {
    pub ok: bool,
    pub tool: String,
    pub source: String,
    pub dest: String,
    pub audit_log_path: Option<String>,
    pub backup_path: Option<String>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legs: Option<Vec<MigrationResultLeg>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub pending_backups: Option<Vec<MigrationBackupEntry>>,
}

fn now_stamp() -> String {
    let dt = chrono::Local::now();
    dt.format("%Y%m%d-%H%M%S").to_string()
}

const DECO_BACKUP_MARKER: &str = ".deco-backup-";

/// Folder names like `Cursor.deco-backup-20260525-194813`.
pub fn is_deco_backup_dir_name(name: &str) -> bool {
    let Some(idx) = name.find(DECO_BACKUP_MARKER) else {
        return false;
    };
    let suffix = &name[idx + DECO_BACKUP_MARKER.len()..];
    !suffix.is_empty()
        && suffix
            .chars()
            .all(|c| c.is_ascii_digit() || c == '-')
}

/// `{source_parent}/{source_name}.deco-backup-*` directories left after migration.
pub fn find_deco_backups_for_source(source: &Path) -> Vec<PathBuf> {
    let Some(parent) = source.parent() else {
        return Vec::new();
    };
    let Some(stem) = source.file_name().and_then(|n| n.to_str()) else {
        return Vec::new();
    };
    let prefix = format!("{stem}{DECO_BACKUP_MARKER}");
    let mut found = Vec::new();
    let Ok(read) = fs::read_dir(parent) else {
        return found;
    };
    for entry in read.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.starts_with(&prefix) || !is_deco_backup_dir_name(name) {
            continue;
        }
        if path.is_dir() {
            found.push(path);
        }
    }
    found.sort_by(|a, b| a.to_string_lossy().cmp(&b.to_string_lossy()));
    found
}

fn is_under(child: &Path, parent: &Path) -> bool {
    // Best-effort prefix check on normalized absolute paths (case-insensitive on Windows).
    let c = child.to_string_lossy().to_lowercase();
    let p = parent.to_string_lossy().to_lowercase();
    if c == p {
        return true;
    }
    c.starts_with(&(p.trim_end_matches(['\\', '/']).to_string() + "\\"))
        || c.starts_with(&(p.trim_end_matches(['\\', '/']).to_string() + "/"))
}

#[cfg(windows)]
fn default_source(tool: &ToolId) -> Result<PathBuf, String> {
    use crate::util::windows_profile_paths::{local_appdata_dir, roaming_appdata_dir};

    let appdata = roaming_appdata_dir()?;
    let profile = user_profile_dir();

    let p = match tool {
        ToolId::Cursor | ToolId::Discord => {
            return Err(format!(
                "{} is a bundle profile; use plan(tool, dest_root) instead.",
                tool.wire()
            ));
        }
        ToolId::CursorRoaming => appdata.join("Cursor"),
        ToolId::CursorLocal => local_appdata_dir()?.join("Cursor"),
        ToolId::Vscode => appdata.join("Code"),
        ToolId::ClaudeCode => {
            let profile = profile.ok_or_else(|| "USERPROFILE is not set".to_string())?;
            profile.join(".claude")
        }
        ToolId::CodexCli => {
            if let Ok(home) = std::env::var("CODEX_HOME") {
                let trimmed = home.trim();
                if !trimmed.is_empty() {
                    return Ok(PathBuf::from(trimmed));
                }
            }
            let profile = profile.ok_or_else(|| "USERPROFILE is not set".to_string())?;
            profile.join(".codex")
        }
        ToolId::ClaudeDesktop => appdata.join("Claude"),
        ToolId::GoogleChrome => local_appdata_dir()?
            .join("Google")
            .join("Chrome")
            .join("User Data"),
        ToolId::MicrosoftEdge => local_appdata_dir()?
            .join("Microsoft")
            .join("Edge")
            .join("User Data"),
        ToolId::Brave => local_appdata_dir()?
            .join("BraveSoftware")
            .join("Brave-Browser")
            .join("User Data"),
        ToolId::Firefox => appdata.join("Mozilla").join("Firefox"),
        ToolId::DiscordRoaming => appdata.join("discord"),
        ToolId::DiscordLocal => local_appdata_dir()?.join("Discord"),
        ToolId::Spotify => appdata.join("Spotify"),
        ToolId::Slack => appdata.join("Slack"),
        ToolId::Telegram => appdata.join("Telegram Desktop"),
        ToolId::Notion => appdata.join("Notion"),
        ToolId::ObsStudio => appdata.join("obs-studio"),
        ToolId::EpicGames => local_appdata_dir()?.join("EpicGamesLauncher"),
        ToolId::SteamAppdata => local_appdata_dir()?.join("Steam"),
        ToolId::BattleNet => local_appdata_dir()?.join("Battle.net"),
        ToolId::DockerDesktop => local_appdata_dir()?.join("Docker"),
        ToolId::NpmCache => {
            if let Ok(local) = local_appdata_dir() {
                local.join("npm-cache")
            } else if let Some(ref profile) = profile {
                profile.join("AppData").join("Local").join("npm-cache")
            } else {
                return Err("Could not resolve npm cache path (LOCALAPPDATA / USERPROFILE).".to_string());
            }
        }
        ToolId::PnpmStore => {
            if let Ok(local) = local_appdata_dir() {
                local.join("pnpm").join("store")
            } else if let Some(ref profile) = profile {
                profile.join("AppData").join("Local").join("pnpm").join("store")
            } else {
                return Err("Could not resolve pnpm store path (LOCALAPPDATA / USERPROFILE).".to_string());
            }
        }
    };
    Ok(p)
}

#[cfg(not(windows))]
fn default_source(_tool: &ToolId) -> Result<PathBuf, String> {
    Err("Tool migration is Windows-only in v0.9.x.".to_string())
}

/// Warn when the user entered the tool leaf folder as the destination root.
pub fn dest_root_leaf_warning(dest_root: &Path, tool: ToolId) -> Option<String> {
    let name = dest_root.file_name()?.to_str()?;
    if name.is_empty() {
        return None;
    }
    if tool.is_bundle() {
        for (_, member) in tool.bundle_members() {
            if name == dest_leaf(&member) {
                let leaf = dest_leaf(&member);
                return Some(format!(
                    "Destination root already ends with \"{leaf}\". Use the parent folder (e.g. G:\\DevToolData) — Deco appends {leaf} automatically."
                ));
            }
        }
        return None;
    }
    let leaf = dest_leaf(&tool);
    if name == leaf {
        Some(format!(
            "Destination root already ends with \"{leaf}\". Use the parent folder (e.g. G:\\DevToolData) — Deco will create …\\{leaf} under it."
        ))
    } else {
        None
    }
}

#[cfg(windows)]
pub fn default_source_for_discovery(tool: &ToolId) -> Result<PathBuf, String> {
    default_source(tool)
}

fn dest_leaf(tool: &ToolId) -> &'static str {
    match tool {
        ToolId::Cursor => "Cursor",
        ToolId::CursorRoaming => "Cursor",
        ToolId::CursorLocal => "Cursor-Local",
        ToolId::Vscode => "Code",
        ToolId::ClaudeCode => "claude-code",
        ToolId::CodexCli => "codex",
        ToolId::ClaudeDesktop => "Claude-Desktop",
        ToolId::GoogleChrome => "Google-Chrome",
        ToolId::MicrosoftEdge => "Microsoft-Edge",
        ToolId::Brave => "Brave-Browser",
        ToolId::Firefox => "Firefox",
        ToolId::Discord => "Discord",
        ToolId::DiscordRoaming => "Discord",
        ToolId::DiscordLocal => "Discord-Local",
        ToolId::Spotify => "Spotify",
        ToolId::Slack => "Slack",
        ToolId::Telegram => "Telegram",
        ToolId::Notion => "Notion",
        ToolId::ObsStudio => "OBS-Studio",
        ToolId::EpicGames => "EpicGamesLauncher",
        ToolId::SteamAppdata => "Steam-Local",
        ToolId::BattleNet => "Battle-net",
        ToolId::DockerDesktop => "Docker",
        ToolId::NpmCache => "npm-cache",
        ToolId::PnpmStore => "pnpm-store",
    }
}

/// Drive-letter mount (e.g. `G:\`) for a path, when available.
pub fn drive_mount_for_path(path: &Path) -> Option<PathBuf> {
    crate::util::volume::quarantine_volume_base(path)
}

#[cfg(windows)]
fn dest_requires_ntfs_error(dest: &Path) -> Option<String> {
    let mount = drive_mount_for_path(dest)?;
    let mount_str = mount.to_string_lossy().to_string();
    match read_volume_filesystem_name(&mount_str) {
        Ok(name) if name.eq_ignore_ascii_case("NTFS") => None,
        Ok(name) => Some(format!(
            "Destination volume uses \"{name}\" (junction migration requires NTFS)."
        )),
        Err(e) => Some(format!("Could not read destination filesystem type: {e}")),
    }
}

#[cfg(not(windows))]
fn dest_requires_ntfs_error(_dest: &Path) -> Option<String> {
    Some("Tool migration is Windows-only in v0.9.x.".to_string())
}

#[cfg(windows)]
fn read_volume_filesystem_name(mount: &str) -> Result<String, String> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use ::windows::core::PCWSTR;
    use ::windows::Win32::Storage::FileSystem::GetVolumeInformationW;

    let wide: Vec<u16> = OsStr::new(mount).encode_wide().chain(Some(0)).collect();
    let mut fs_buf = [0u16; 32];
    unsafe {
        GetVolumeInformationW(
            PCWSTR(wide.as_ptr()),
            None,
            None,
            None,
            None,
            Some(&mut fs_buf),
        )
        .map_err(|e| format!("{e}"))?;
    }
    let len = fs_buf.iter().position(|&c| c == 0).unwrap_or(0);
    Ok(String::from_utf16_lossy(&fs_buf[..len]))
}

#[cfg(windows)]
fn blocked_source(source: &Path) -> Option<String> {
    crate::util::migration_path_policy::migration_path_block_reason(
        source,
        crate::util::migration_path_policy::MigrationPathRole::Source,
    )
}

#[cfg(windows)]
fn blocked_dest(dest: &Path) -> Option<String> {
    crate::util::migration_path_policy::migration_path_block_reason(
        dest,
        crate::util::migration_path_policy::MigrationPathRole::Dest,
    )
}

#[cfg(not(windows))]
fn blocked_source(_source: &Path) -> Option<String> {
    None
}

#[cfg(not(windows))]
fn blocked_dest(_dest: &Path) -> Option<String> {
    None
}

fn estimate_tree(source: &Path) -> (Option<u64>, Option<u64>, Vec<String>) {
    let mut bytes: u64 = 0;
    let mut files: u64 = 0;
    let mut warnings: Vec<String> = Vec::new();
    for entry in WalkDir::new(source).follow_links(false) {
        let entry = match entry {
            Ok(e) => e,
            Err(e) => {
                warnings.push(format!("Walk warning: {e}"));
                continue;
            }
        };
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(e) => {
                warnings.push(format!("Metadata warning: {} ({e})", entry.path().display()));
                continue;
            }
        };
        if meta.is_file() {
            bytes = bytes.saturating_add(meta.len());
            files = files.saturating_add(1);
        }
    }
    (Some(bytes), Some(files), warnings)
}

fn migration_backup_entry(path: PathBuf, leg: Option<String>, include_size: bool) -> MigrationBackupEntry {
    let (bytes, file_count) = if include_size {
        let (b, f, _) = estimate_tree(&path);
        (b, f)
    } else {
        (None, None)
    };
    MigrationBackupEntry {
        leg,
        path: path.to_string_lossy().to_string(),
        bytes,
        file_count,
    }
}

fn attach_pending_backups(plan: &mut MigrationPlan, include_size: bool) {
    use std::collections::HashSet;

    let sources: Vec<(Option<String>, String)> = if let Some(legs) = &plan.legs {
        legs.iter()
            .map(|l| (Some(l.leg.clone()), l.source.clone()))
            .collect()
    } else if !plan.source.is_empty() {
        vec![(None, plan.source.clone())]
    } else {
        Vec::new()
    };

    let mut seen = HashSet::new();
    let mut entries = Vec::new();
    for (leg, source) in sources {
        for path in find_deco_backups_for_source(Path::new(&source)) {
            let key = path.to_string_lossy().to_lowercase();
            if seen.insert(key) {
                entries.push(migration_backup_entry(path, leg.clone(), include_size));
            }
        }
    }
    plan.pending_backups = if entries.is_empty() {
        None
    } else {
        Some(entries)
    };
}

/// Delete a Deco migration backup folder after user confirmation in the UI.
pub fn delete_migration_backup(path: &Path) -> Result<u64, String> {
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid backup path.".to_string())?;
    if !is_deco_backup_dir_name(name) {
        return Err("Path is not a Deco migration backup folder.".to_string());
    }
    if !path.is_dir() {
        return Err(format!("Backup path is not a directory: {}", path.display()));
    }
    if fs::symlink_metadata(path)
        .map(|m| m.file_type().is_symlink())
        .unwrap_or(false)
    {
        return Err("Refusing to delete a junction or symlink.".to_string());
    }
    if let Some(msg) = blocked_source(path) {
        return Err(msg);
    }
    let (bytes, _, _) = estimate_tree(path);
    fs::remove_dir_all(path).map_err(|e| format!("Failed deleting backup: {} ({e})", path.display()))?;
    Ok(bytes.unwrap_or(0))
}

fn attach_running_process_warning(plan: &mut MigrationPlan, tool: ToolId) {
    let running = crate::util::tool_migration_processes::detect_running_processes(tool);
    if running.is_empty() {
        plan.running_processes = None;
        return;
    }
    plan.running_processes = Some(running.clone());
    if let Some(msg) = crate::util::tool_migration_processes::running_process_warning(tool) {
        if !plan.warnings.iter().any(|w| w.contains("Close these processes")) {
            plan.warnings.push(msg);
        }
    }
}

fn format_bytes_hint(bytes: u64) -> String {
    const GB: f64 = 1024.0 * 1024.0 * 1024.0;
    const MB: f64 = 1024.0 * 1024.0;
    if bytes as f64 >= GB {
        format!("{:.1} GB", bytes as f64 / GB)
    } else if bytes as f64 >= MB {
        format!("{:.0} MB", bytes as f64 / MB)
    } else {
        format!("{bytes} bytes")
    }
}

fn dest_size_suffix(dest: &Path, include_size: bool) -> String {
    use crate::util::windows_profile_paths::{check_migration_dest_dir, DestDirCheck};
    if !include_size || check_migration_dest_dir(dest) != DestDirCheck::HasData {
        return String::new();
    }
    let (bytes, _, _) = estimate_tree(dest);
    bytes
        .map(|b| format!(" ({format} verified on destination)", format = format_bytes_hint(b)))
        .unwrap_or_default()
}

fn is_optional_bundle_leg(member: ToolId) -> bool {
    matches!(member, ToolId::CursorLocal | ToolId::DiscordLocal)
}

fn custom_migration_already_complete(
    source: &Path,
    dest: &Path,
    source_check: crate::util::windows_profile_paths::SourceDirCheck,
) -> bool {
    use crate::util::windows_profile_paths::{
        check_migration_dest_dir, junction_points_to, DestDirCheck, SourceDirCheck,
    };

    match source_check {
        SourceDirCheck::AlreadyLink => {
            junction_points_to(source, dest) && check_migration_dest_dir(dest) == DestDirCheck::HasData
        }
        SourceDirCheck::NotFound => check_migration_dest_dir(dest) == DestDirCheck::HasData,
        _ => false,
    }
}

fn custom_migration_skip_reason(
    source: &Path,
    dest: &Path,
    source_check: crate::util::windows_profile_paths::SourceDirCheck,
    include_size: bool,
) -> String {
    bundle_leg_skip_reason_with_dest(ToolId::Vscode, source, dest, source_check, include_size)
}

fn leg_indicates_already_complete(
    member: ToolId,
    source: &Path,
    dest: &Path,
    source_check: crate::util::windows_profile_paths::SourceDirCheck,
) -> bool {
    use crate::util::windows_profile_paths::{
        check_migration_dest_dir, junction_points_to, DestDirCheck, SourceDirCheck,
    };

    match source_check {
        SourceDirCheck::AlreadyLink => {
            junction_points_to(source, dest) && check_migration_dest_dir(dest) == DestDirCheck::HasData
        }
        SourceDirCheck::NotFound if is_optional_bundle_leg(member) => {
            check_migration_dest_dir(dest) == DestDirCheck::HasData
        }
        SourceDirCheck::NotFound => check_migration_dest_dir(dest) == DestDirCheck::HasData,
        _ => false,
    }
}

fn bundle_leg_skip_reason_with_dest(
    member: ToolId,
    source: &Path,
    dest: &Path,
    source_check: crate::util::windows_profile_paths::SourceDirCheck,
    include_size: bool,
) -> String {
    use crate::util::windows_profile_paths::{
        check_migration_dest_dir, junction_points_to, junction_target, source_check_message,
        DestDirCheck, SourceDirCheck,
    };

    let size = dest_size_suffix(dest, include_size);

    match source_check {
        SourceDirCheck::AlreadyLink => {
            if junction_points_to(source, dest) {
                return match check_migration_dest_dir(dest) {
                    DestDirCheck::HasData => format!(
                        "Migration already complete — {} is a junction to {}{size}. No action needed.",
                        source.display(),
                        dest.display()
                    ),
                    DestDirCheck::Empty => format!(
                        "Junction at {} points to {} but the destination folder is empty — verify with Open destination or restore from a *.deco-backup-* folder.",
                        source.display(),
                        dest.display()
                    ),
                    DestDirCheck::NotFound => format!(
                        "Junction at {} points to {} but the destination folder is missing — check that the target drive is connected.",
                        source.display(),
                        dest.display()
                    ),
                    DestDirCheck::NotDirectory => format!(
                        "Junction at {} points to {} but the destination is not a folder.",
                        source.display(),
                        dest.display()
                    ),
                    DestDirCheck::Inaccessible => format!(
                        "Junction at {} points to {} but the destination cannot be read — check drive permissions.",
                        source.display(),
                        dest.display()
                    ),
                };
            }
            if let Some(target) = junction_target(source) {
                if check_migration_dest_dir(dest) == DestDirCheck::HasData {
                    return format!(
                        "Junction at {} -> {} (not the planned {}). {} already has migrated data{size} — verify with Open destination.",
                        source.display(),
                        target.display(),
                        dest.display(),
                        dest.display()
                    );
                }
                return format!(
                    "Junction at {} -> {} (expected {}). Adjust destination root or remove the existing link.",
                    source.display(),
                    target.display(),
                    dest.display()
                );
            }
            source_check_message(source, SourceDirCheck::AlreadyLink)
        }
        SourceDirCheck::NotFound => {
            if is_optional_bundle_leg(member) {
                if check_migration_dest_dir(dest) == DestDirCheck::HasData {
                    return format!(
                        "Optional leg — {} was not found (many installs skip Local). {} already has data{size}.",
                        source.display(),
                        dest.display()
                    );
                }
                return format!(
                    "Optional leg — {} was not found. Many installs have no Local cache folder.",
                    source.display()
                );
            }
            match check_migration_dest_dir(dest) {
                DestDirCheck::HasData => format!(
                    "Source {} not found; {} already contains migrated data{size}. Migration may have completed previously.",
                    source.display(),
                    dest.display()
                ),
                _ => format!(
                    "Source not found: {} — the application may not be installed, or it has never stored data under this Windows user.",
                    source.display()
                ),
            }
        }
        other => source_check_message(source, other),
    }
}

enum IdleBundleOutcome {
    AlreadyComplete { message: String },
    NothingToMigrate { message: String },
    Problems(Vec<String>),
}

fn evaluate_idle_bundle(legs: &[MigrationPlanLeg]) -> IdleBundleOutcome {
    use crate::util::windows_profile_paths::{
        check_migrate_source_dir, check_migration_dest_dir, junction_points_to, junction_target,
        source_check_message, DestDirCheck, SourceDirCheck,
    };

    let mut migrated_legs: Vec<String> = Vec::new();
    let mut missing_legs: Vec<String> = Vec::new();
    let mut problems: Vec<String> = Vec::new();

    for leg in legs {
        if !leg.skipped {
            continue;
        }
        let source = Path::new(&leg.source);
        let dest = Path::new(&leg.dest);
        match check_migrate_source_dir(source) {
            SourceDirCheck::AlreadyLink => {
                if junction_points_to(source, dest) {
                    if check_migration_dest_dir(dest) == DestDirCheck::HasData {
                        migrated_legs.push(leg.leg.clone());
                    } else {
                        problems.push(format!(
                            "[{}] Junction at {} points to {} but destination data could not be verified — use Open destination.",
                            leg.leg,
                            source.display(),
                            dest.display()
                        ));
                    }
                } else if let Some(target) = junction_target(source) {
                    if check_migration_dest_dir(dest) == DestDirCheck::HasData {
                        migrated_legs.push(leg.leg.clone());
                    } else {
                        problems.push(format!(
                            "[{}] Junction {} -> {} (expected {}). Adjust destination root or remove the existing link.",
                            leg.leg,
                            source.display(),
                            target.display(),
                            dest.display()
                        ));
                    }
                } else {
                    problems.push(format!("[{}] {}", leg.leg, source_check_message(source, SourceDirCheck::AlreadyLink)));
                }
            }
            SourceDirCheck::NotFound => missing_legs.push(leg.leg.clone()),
            check => problems.push(format!("[{}] {}", leg.leg, source_check_message(source, check))),
        }
    }

    if !problems.is_empty() {
        return IdleBundleOutcome::Problems(problems);
    }

    if !migrated_legs.is_empty() {
        let mut parts = vec![format!(
            "{} verified on destination",
            migrated_legs.join(", ")
        )];
        if !missing_legs.is_empty() {
            parts.push(format!(
                "{} had no source folder (optional or not installed on this machine)",
                missing_legs.join(", ")
            ));
        }
        parts.push(
            "Migration already complete — Open source to follow the junction; Open destination to confirm data. \
             Remove leftover *.deco-backup-* folders below when the tool runs normally."
                .to_string(),
        );
        return IdleBundleOutcome::AlreadyComplete {
            message: parts.join(". "),
        };
    }

    let dest_with_data: Vec<&MigrationPlanLeg> = legs
        .iter()
        .filter(|leg| check_migration_dest_dir(Path::new(&leg.dest)) == DestDirCheck::HasData)
        .collect();
    if !dest_with_data.is_empty() && missing_legs.len() == legs.iter().filter(|l| l.skipped).count() {
        return IdleBundleOutcome::AlreadyComplete {
            message: format!(
                "Destination already contains migrated data ({}), but no source folders are ready to migrate. \
                 The tool may not be installed, or migration completed in a prior session — use Open destination to verify.",
                dest_with_data
                    .iter()
                    .map(|l| l.dest.as_str())
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
        };
    }

    IdleBundleOutcome::NothingToMigrate {
        message: "No source folders were found to migrate — install the application, launch it once under this Windows user, then Plan again.".to_string(),
    }
}

fn plan_bundle(tool: ToolId, dest_root: &Path, include_size: bool) -> MigrationPlan {
    let tool_wire = tool.wire().to_string();
    let mut warnings: Vec<String> = Vec::new();
    if let Some(w) = dest_root_leaf_warning(dest_root, tool) {
        warnings.push(w);
    }
    let mut errors: Vec<String> = Vec::new();
    let mut plan_legs: Vec<MigrationPlanLeg> = Vec::new();
    let mut total_bytes: u64 = 0;
    let mut total_files: u64 = 0;
    let mut has_size = false;
    let mut active_legs = 0usize;

    for (leg_name, member) in tool.bundle_members() {
        let source = match default_source(&member) {
            Ok(p) => p,
            Err(e) => {
                errors.push(format!("[{leg_name}] {e}"));
                continue;
            }
        };
        let dest = dest_root.join(dest_leaf(&member));

        let source_check = crate::util::windows_profile_paths::check_migrate_source_dir(&source);
        if source_check != crate::util::windows_profile_paths::SourceDirCheck::Ready {
            let msg = bundle_leg_skip_reason_with_dest(*member, &source, &dest, source_check, include_size);
            let (dest_bytes, dest_files) =
                if include_size && crate::util::windows_profile_paths::check_migration_dest_dir(&dest)
                    == crate::util::windows_profile_paths::DestDirCheck::HasData
                {
                    let (b, f, _) = estimate_tree(&dest);
                    (b, f)
                } else {
                    (None, None)
                };
            plan_legs.push(MigrationPlanLeg {
                leg: leg_name.to_string(),
                source: source.to_string_lossy().to_string(),
                dest: dest.to_string_lossy().to_string(),
                bytes: dest_bytes,
                file_count: dest_files,
                skipped: true,
                skip_reason: Some(msg),
            });
            continue;
        }

        let member_plan_only = member.is_plan_only();
        let leg_plan = plan_paths(member.wire(), source.clone(), dest.clone(), include_size, member_plan_only);
        warnings.extend(leg_plan.warnings);
        if !leg_plan.ok {
            errors.extend(leg_plan.errors.into_iter().map(|e| format!("[{leg_name}] {e}")));
            plan_legs.push(MigrationPlanLeg {
                leg: leg_name.to_string(),
                source: leg_plan.source,
                dest: leg_plan.dest,
                bytes: leg_plan.bytes,
                file_count: leg_plan.file_count,
                skipped: false,
                skip_reason: None,
            });
            continue;
        }

        active_legs += 1;
        if let Some(b) = leg_plan.bytes {
            total_bytes = total_bytes.saturating_add(b);
            has_size = true;
        }
        if let Some(f) = leg_plan.file_count {
            total_files = total_files.saturating_add(f);
        }
        plan_legs.push(MigrationPlanLeg {
            leg: leg_name.to_string(),
            source: leg_plan.source,
            dest: leg_plan.dest,
            bytes: leg_plan.bytes,
            file_count: leg_plan.file_count,
            skipped: false,
            skip_reason: None,
        });
    }

    let mut already_complete = false;

    if active_legs == 0 && errors.is_empty() {
        match evaluate_idle_bundle(&plan_legs) {
            IdleBundleOutcome::AlreadyComplete { message } => {
                warnings.push(message);
                already_complete = true;
            }
            IdleBundleOutcome::NothingToMigrate { message } => {
                let profile_hint = user_profile_dir()
                    .map(|p| format!(" Profile: {}.", p.display()))
                    .unwrap_or_default();
                errors.push(format!(
                    "{message}{profile_hint} Use destination root like G:\\DevToolData (not G:\\DevToolData\\Cursor)."
                ));
            }
            IdleBundleOutcome::Problems(problems) => errors.extend(problems),
        }
    }

    let ok = (active_legs > 0 || already_complete) && errors.is_empty();
    let first_active = plan_legs.iter().find(|l| !l.skipped);

    let mut plan = MigrationPlan {
        ok,
        tool: tool_wire.clone(),
        source: first_active
            .map(|l| l.source.clone())
            .unwrap_or_else(|| plan_legs.first().map(|l| l.source.clone()).unwrap_or_default()),
        dest: first_active
            .map(|l| l.dest.clone())
            .unwrap_or_else(|| plan_legs.first().map(|l| l.dest.clone()).unwrap_or_default()),
        bytes: if has_size { Some(total_bytes) } else { None },
        file_count: if has_size { Some(total_files) } else { None },
        warnings,
        errors,
        plan_only: false,
        already_complete,
        custom_mode: false,
        legs: Some(plan_legs),
        running_processes: None,
        pending_backups: None,
    };
    attach_running_process_warning(&mut plan, tool);
    attach_pending_backups(&mut plan, include_size);
    plan
}

pub fn plan(tool: ToolId, dest_root: &Path, include_size: bool) -> MigrationPlan {
    if tool.is_bundle() {
        return plan_bundle(tool, dest_root, include_size);
    }

    let mut dest_warnings: Vec<String> = Vec::new();
    if let Some(w) = dest_root_leaf_warning(dest_root, tool) {
        dest_warnings.push(w);
    }

    let plan_only = tool.is_plan_only();
    let source = match default_source(&tool) {
        Ok(p) => p,
        Err(e) => {
            return MigrationPlan {
                ok: false,
                tool: tool.wire().to_string(),
                source: String::new(),
                dest: String::new(),
                bytes: None,
                file_count: None,
                warnings: vec![],
                errors: vec![e],
                plan_only,
                already_complete: false,
                custom_mode: false,
                legs: None,
                running_processes: None,
                pending_backups: None,
            };
        }
    };
    let dest = dest_root.join(dest_leaf(&tool));
    let mut plan = plan_paths(tool.wire(), source, dest, include_size, plan_only);
    plan.warnings = dest_warnings.into_iter().chain(plan.warnings).collect();
    plan
}

/// Plan migration for explicit source/dest paths (advanced / custom).
pub fn plan_paths(
    tool_wire: &str,
    source: PathBuf,
    dest: PathBuf,
    include_size: bool,
    plan_only: bool,
) -> MigrationPlan {
    let mut warnings: Vec<String> = Vec::new();
    let mut errors: Vec<String> = Vec::new();

    if plan_only {
        warnings.push(format!(
            "{} migration is plan-only in this release (see docs/product/tool-migration-profiles.md).",
            tool_wire
        ));
    }

    let custom_mode = tool_wire == "custom";
    if custom_mode {
        warnings.push(
            "Custom folder migration — pick a specific subfolder (e.g. Documents\\Electronic Arts\\The Sims 4\\Mods), \
             not entire Documents, AppData, or your user profile."
                .to_string(),
        );
    }

    if let Some(msg) = blocked_source(&source) {
        errors.push(msg);
    }
    if let Some(msg) = blocked_dest(&dest) {
        errors.push(msg);
    }
    if let Some(msg) = dest_requires_ntfs_error(&dest) {
        errors.push(msg);
    }
    let source_check = crate::util::windows_profile_paths::check_migrate_source_dir(&source);
    let mut already_complete = false;
    if source_check != crate::util::windows_profile_paths::SourceDirCheck::Ready {
        if tool_wire == "custom" {
            let msg = custom_migration_skip_reason(&source, &dest, source_check, include_size);
            if custom_migration_already_complete(&source, &dest, source_check) {
                warnings.push(msg);
                already_complete = true;
            } else {
                errors.push(msg);
            }
        } else if let Ok(id) = ToolId::parse(tool_wire) {
            let msg = bundle_leg_skip_reason_with_dest(id, &source, &dest, source_check, include_size);
            if leg_indicates_already_complete(id, &source, &dest, source_check) {
                warnings.push(msg);
                already_complete = true;
            } else {
                errors.push(msg);
            }
        } else {
            errors.push(crate::util::windows_profile_paths::source_check_message(
                &source,
                source_check,
            ));
        }
    }
    if is_under(&dest, &source) {
        errors.push("Destination is inside source; refusing.".to_string());
    }
    if is_under(&source, &dest) {
        errors.push("Source is inside destination; refusing.".to_string());
    }

    let (bytes, file_count) = if include_size && errors.is_empty() && !already_complete {
        let (b, f, w) = estimate_tree(&source);
        warnings.extend(w.into_iter().take(8));
        (b, f)
    } else if include_size && already_complete {
        let (b, f, w) = estimate_tree(&dest);
        warnings.extend(w.into_iter().take(8));
        (b, f)
    } else {
        (None, None)
    };

    let mut plan = MigrationPlan {
        ok: errors.is_empty() || already_complete,
        tool: tool_wire.to_string(),
        source: source.to_string_lossy().to_string(),
        dest: dest.to_string_lossy().to_string(),
        bytes,
        file_count,
        warnings,
        errors,
        plan_only,
        already_complete,
        custom_mode,
        legs: None,
        running_processes: None,
        pending_backups: None,
    };
    if let Ok(id) = ToolId::parse(tool_wire) {
        attach_running_process_warning(&mut plan, id);
    }
    attach_pending_backups(&mut plan, include_size);
    plan
}

fn copy_tree(source: &Path, dest: &Path) -> Result<Vec<String>, String> {
    let mut warnings: Vec<String> = Vec::new();
    for entry in WalkDir::new(source).follow_links(false) {
        let entry = entry.map_err(|e| format!("Walk error: {e}"))?;
        let rel = entry.path().strip_prefix(source).map_err(|e| format!("strip_prefix failed: {e}"))?;
        let out = dest.join(rel);
        let meta = entry.metadata().map_err(|e| format!("metadata failed: {e}"))?;
        if meta.is_dir() {
            fs::create_dir_all(&out).map_err(|e| format!("create dir failed: {} ({e})", out.display()))?;
            continue;
        }
        if meta.file_type().is_symlink() {
            warnings.push(format!("Skipped symlink: {}", entry.path().display()));
            continue;
        }
        if meta.is_file() {
            if let Some(parent) = out.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("create parent failed: {} ({e})", parent.display()))?;
            }
            fs::copy(entry.path(), &out)
                .map_err(|e| format!("copy failed: {} -> {} ({e})", entry.path().display(), out.display()))?;
        }
    }
    Ok(warnings)
}

#[cfg(windows)]
fn mklink_junction(link_path: &Path, target: &Path) -> Result<(), String> {
    let link = link_path.to_string_lossy().to_string();
    let tgt = target.to_string_lossy().to_string();
    let output = Command::new("cmd")
        .args(["/C", "mklink", "/J", &link, &tgt])
        .output()
        .map_err(|e| format!("failed to start mklink: {e}"))?;
    if !output.status.success() {
        let msg = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(format!("mklink failed: {msg}"));
    }
    Ok(())
}

#[cfg(not(windows))]
fn mklink_junction(_link_path: &Path, _target: &Path) -> Result<(), String> {
    Err("Tool migration is Windows-only in v0.9.0.".to_string())
}

/// Verify junction without `canonicalize` on the link (fails on cross-volume mount points, Windows error 448).
fn verify_junction_target(source: &Path, dest: &Path) -> Result<(), String> {
    let expected = fs::canonicalize(dest).map_err(|e| format!("failed canonicalize dest: {e}"))?;

    #[cfg(windows)]
    {
        let link_target = fs::read_link(source)
            .map_err(|e| format!("failed reading junction target: {e}"))?;
        let resolved = fs::canonicalize(&link_target).unwrap_or(link_target);
        if resolved.to_string_lossy().eq_ignore_ascii_case(&expected.to_string_lossy()) {
            return Ok(());
        }
        return Err(format!(
            "junction verification failed: {} -> {} (expected {})",
            source.display(),
            resolved.display(),
            expected.display()
        ));
    }

    #[cfg(not(windows))]
    {
        let _ = (source, expected);
        Ok(())
    }
}

pub fn run(
    tool: ToolId,
    dest_root: &Path,
    include_size: bool,
    copy_only: bool,
    audit_dir: &Path,
) -> MigrationResult {
    let plan = plan(tool, dest_root, include_size);
    run_from_plan(plan, copy_only, audit_dir)
}

fn execute_migration_leg(
    source: &Path,
    dest: &Path,
    copy_only: bool,
) -> Result<Option<PathBuf>, String> {
    if let Some(parent) = dest.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed creating dest parent: {} ({e})", parent.display()))?;
    }
    if dest.exists() {
        let empty = fs::read_dir(dest)
            .map_err(|e| format!("failed reading dest: {} ({e})", dest.display()))?
            .next()
            .is_none();
        if !empty {
            return Err(format!("Destination exists and is not empty: {}", dest.display()));
        }
    } else {
        fs::create_dir_all(dest)
            .map_err(|e| format!("failed creating dest: {} ({e})", dest.display()))?;
    }

    let copy_warnings = copy_tree(source, dest)?;
    let _ = copy_warnings;

    if copy_only {
        return Ok(None);
    }

    let stamp = now_stamp();
    let backup = PathBuf::from(format!("{}.deco-backup-{}", source.display(), stamp));
    fs::rename(source, &backup).map_err(|e| format!("failed renaming source to backup: {e}"))?;

    let rollback = || {
        let _ = fs::remove_dir_all(source);
        let _ = fs::rename(&backup, source);
    };

    if let Err(e) = mklink_junction(source, dest) {
        rollback();
        return Err(e);
    }

    if let Err(e) = verify_junction_target(source, dest) {
        rollback();
        return Err(e);
    }

    // Keep backup on disk until the user removes it from Settings after verifying the tool.
    Ok(Some(backup))
}

fn run_bundle_from_plan(plan: MigrationPlan, copy_only: bool, audit_dir: &Path) -> MigrationResult {
    let warnings = plan.warnings.clone();
    let mut errors = plan.errors.clone();
    let legs = plan.legs.clone().unwrap_or_default();
    let mut result_legs: Vec<MigrationResultLeg> = Vec::new();
    let mut all_ok = true;

    for leg in legs {
        if leg.skipped {
            result_legs.push(MigrationResultLeg {
                leg: leg.leg,
                ok: true,
                source: leg.source,
                dest: leg.dest,
                backup_path: None,
                skipped: Some(true),
            });
            continue;
        }

        let source = PathBuf::from(&leg.source);
        let dest = PathBuf::from(&leg.dest);
        let run_result = execute_migration_leg(&source, &dest, copy_only);
        match run_result {
            Ok(backup) => {
                result_legs.push(MigrationResultLeg {
                    leg: leg.leg.clone(),
                    ok: true,
                    source: leg.source,
                    dest: leg.dest,
                    backup_path: backup.map(|p| p.to_string_lossy().to_string()),
                    skipped: Some(false),
                });
            }
            Err(e) => {
                all_ok = false;
                errors.push(format!("[{}] {e}", leg.leg));
                result_legs.push(MigrationResultLeg {
                    leg: leg.leg,
                    ok: false,
                    source: leg.source,
                    dest: leg.dest,
                    backup_path: None,
                    skipped: Some(false),
                });
                break;
            }
        }
    }

    let stamp = now_stamp();
    let audit_path = audit_dir.join(format!("migration-bundle-{}.json", stamp));
    let audit_log_path = if fs::create_dir_all(audit_dir).is_ok() {
        let payload = serde_json::json!({
            "ts": chrono::Local::now().to_rfc3339(),
            "tool": plan.tool,
            "bundle": true,
            "ok": all_ok,
            "legs": result_legs,
            "warnings": warnings,
            "errors": errors,
        });
        if fs::write(&audit_path, serde_json::to_string_pretty(&payload).unwrap_or_default()).is_ok() {
            Some(audit_path.to_string_lossy().to_string())
        } else {
            None
        }
    } else {
        None
    };

    let pending_backups = {
        let mut refreshed = plan.clone();
        attach_pending_backups(&mut refreshed, true);
        refreshed.pending_backups
    };

    MigrationResult {
        ok: all_ok,
        tool: plan.tool,
        source: plan.source,
        dest: plan.dest,
        audit_log_path,
        backup_path: None,
        warnings,
        errors,
        legs: Some(result_legs),
        pending_backups,
    }
}

pub fn run_from_plan(plan: MigrationPlan, copy_only: bool, audit_dir: &Path) -> MigrationResult {
    let warnings = plan.warnings.clone();
    let mut errors = plan.errors.clone();

    if !plan.ok {
        return MigrationResult {
            ok: false,
            tool: plan.tool,
            source: plan.source,
            dest: plan.dest,
            audit_log_path: None,
            backup_path: None,
            warnings,
            errors,
            legs: None,
            pending_backups: None,
        };
    }
    if plan.plan_only {
        errors.push("This tool is plan-only in v0.9.x.".to_string());
        return MigrationResult {
            ok: false,
            tool: plan.tool,
            source: plan.source,
            dest: plan.dest,
            audit_log_path: None,
            backup_path: None,
            warnings,
            errors,
            legs: None,
            pending_backups: None,
        };
    }

    if let Ok(id) = ToolId::parse(&plan.tool) {
        let running = crate::util::tool_migration_processes::detect_running_processes(id);
        if !running.is_empty() {
            errors.push(format!(
                "Cannot run migration while these processes are running: {}. Close them and try Plan again.",
                running.join(", ")
            ));
            return MigrationResult {
                ok: false,
                tool: plan.tool,
                source: plan.source,
                dest: plan.dest,
                audit_log_path: None,
                backup_path: None,
                warnings,
                errors,
                legs: None,
                pending_backups: None,
            };
        }
    }

    if plan.legs.is_some() {
        return run_bundle_from_plan(plan, copy_only, audit_dir);
    }

    let source = PathBuf::from(&plan.source);
    let dest = PathBuf::from(&plan.dest);

    let stamp = now_stamp();
    let audit_path = audit_dir.join(format!("migration-{}.json", stamp));

    let backup_path_out: Option<String>;

    let write_audit = |payload: &serde_json::Value| -> Option<String> {
        if fs::create_dir_all(audit_dir).is_err() {
            return None;
        }
        if fs::write(&audit_path, serde_json::to_string_pretty(payload).unwrap_or_default()).is_err() {
            return None;
        }
        Some(audit_path.to_string_lossy().to_string())
    };

    let mut ok = false;

    let exec = execute_migration_leg(&source, &dest, copy_only);
    backup_path_out = exec
        .as_ref()
        .ok()
        .and_then(|b| b.as_ref())
        .map(|p| p.to_string_lossy().to_string());

    match exec {
        Ok(_) => {
            ok = true;
        }
        Err(e) => {
            errors.push(e);
        }
    }

    let audit_payload = serde_json::json!({
        "ts": chrono::Local::now().to_rfc3339(),
        "tool": plan.tool,
        "source": plan.source,
        "dest": plan.dest,
        "copy_only": copy_only,
        "ok": ok,
        "warnings": warnings,
        "errors": errors,
    });
    let audit_log_out = write_audit(&audit_payload);

    let pending_backups = if ok {
        let mut refreshed = plan.clone();
        attach_pending_backups(&mut refreshed, true);
        refreshed.pending_backups
    } else {
        None
    };

    MigrationResult {
        ok,
        tool: plan.tool,
        source: plan.source,
        dest: plan.dest,
        audit_log_path: audit_log_out,
        backup_path: backup_path_out,
        warnings,
        errors,
        legs: None,
        pending_backups,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_under_detects_nested_dest() {
        let parent = PathBuf::from(r"C:\Users\me\AppData\Roaming\Cursor");
        let child = parent.join("nested");
        assert!(is_under(&child, &parent));
        assert!(!is_under(&parent, &child));
    }

    #[cfg(windows)]
    #[test]
    fn blocked_source_rejects_drive_root() {
        let root = PathBuf::from(r"C:\");
        assert!(blocked_source(&root).is_some());
    }

    #[cfg(windows)]
    #[test]
    fn dest_ntfs_check_accepts_typical_drive() {
        // CI/dev machines usually have NTFS on C:.
        let dest = PathBuf::from(r"C:\Temp\deco-migrate-test-dest");
        assert!(dest_requires_ntfs_error(&dest).is_none());
    }

    #[test]
    fn is_deco_backup_dir_name_accepts_migration_backups() {
        assert!(is_deco_backup_dir_name("Cursor.deco-backup-20260525-194813"));
        assert!(!is_deco_backup_dir_name("Cursor"));
        assert!(!is_deco_backup_dir_name("Cursor.deco-backup-evil"));
    }

    #[test]
    fn dest_root_leaf_warning_detects_cursor_in_root() {
        let root = PathBuf::from(r"G:\DevToolData\Cursor");
        let msg = dest_root_leaf_warning(&root, ToolId::Cursor).expect("warning");
        assert!(msg.contains("Cursor"));
    }

    #[test]
    fn dest_root_leaf_warning_allows_parent_root() {
        let root = PathBuf::from(r"G:\DevToolData");
        assert!(dest_root_leaf_warning(&root, ToolId::Cursor).is_none());
    }
}

