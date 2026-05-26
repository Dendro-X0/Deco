use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::process::Command;
use walkdir::WalkDir;

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
            ToolId::DockerDesktop => "docker-desktop",
            ToolId::NpmCache => "npm-cache",
            ToolId::PnpmStore => "pnpm-store",
        }
    }

    pub fn is_plan_only(self) -> bool {
        matches!(
            self,
            ToolId::ClaudeDesktop
                | ToolId::DockerDesktop
                | ToolId::NpmCache
                | ToolId::PnpmStore
        )
    }

    pub fn is_bundle(self) -> bool {
        matches!(self, ToolId::Cursor)
    }

    pub fn bundle_members(self) -> &'static [(&'static str, ToolId)] {
        match self {
            ToolId::Cursor => &[("roaming", ToolId::CursorRoaming), ("local", ToolId::CursorLocal)],
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub legs: Option<Vec<MigrationPlanLeg>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub running_processes: Option<Vec<String>>,
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
}

fn now_stamp() -> String {
    let dt = chrono::Local::now();
    dt.format("%Y%m%d-%H%M%S").to_string()
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
fn user_profile_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE").map(PathBuf::from)
}

#[cfg(windows)]
fn default_source(tool: &ToolId) -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA is not set".to_string())?;
    let local = std::env::var("LOCALAPPDATA").ok();
    let profile = user_profile_dir();

    let p = match tool {
        ToolId::Cursor => {
            return Err("cursor is a bundle profile; use plan(tool, dest_root) instead.".to_string());
        }
        ToolId::CursorRoaming => PathBuf::from(appdata).join("Cursor"),
        ToolId::CursorLocal => {
            let local = local.ok_or_else(|| "LOCALAPPDATA is not set".to_string())?;
            PathBuf::from(local).join("Cursor")
        }
        ToolId::Vscode => PathBuf::from(appdata).join("Code"),
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
        ToolId::ClaudeDesktop => PathBuf::from(appdata).join("Claude"),
        ToolId::DockerDesktop => {
            let local = local.ok_or_else(|| "LOCALAPPDATA is not set".to_string())?;
            PathBuf::from(local).join("Docker")
        }
        ToolId::NpmCache => {
            if let Some(ref local) = local {
                PathBuf::from(local).join("npm-cache")
            } else if let Some(ref profile) = profile {
                profile.join("AppData").join("Local").join("npm-cache")
            } else {
                return Err("Could not resolve npm cache path (LOCALAPPDATA / USERPROFILE).".to_string());
            }
        }
        ToolId::PnpmStore => {
            if let Some(ref local) = local {
                PathBuf::from(local).join("pnpm").join("store")
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

fn dest_leaf(tool: &ToolId) -> &'static str {
    match tool {
        ToolId::Cursor => "Cursor",
        ToolId::CursorRoaming => "Cursor",
        ToolId::CursorLocal => "Cursor-Local",
        ToolId::Vscode => "Code",
        ToolId::ClaudeCode => "claude-code",
        ToolId::CodexCli => "codex",
        ToolId::ClaudeDesktop => "Claude-Desktop",
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
    let s = source.to_string_lossy().to_lowercase();
    let roots = [
        std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string()),
        std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string()),
        std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string()),
        std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string()),
    ]
    .map(|p| p.to_lowercase());
    if roots.iter().any(|p| s == *p) {
        return Some("Refusing to migrate a protected root directory.".to_string());
    }
    // Refuse drive roots like C:\
    if s.len() <= 3 && s.ends_with(":\\") {
        return Some("Refusing to migrate a drive root.".to_string());
    }
    None
}

#[cfg(not(windows))]
fn blocked_source(_source: &Path) -> Option<String> {
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

fn plan_bundle(tool: ToolId, dest_root: &Path, include_size: bool) -> MigrationPlan {
    let tool_wire = tool.wire().to_string();
    let mut warnings: Vec<String> = Vec::new();
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

        if !source.is_dir() {
            plan_legs.push(MigrationPlanLeg {
                leg: leg_name.to_string(),
                source: source.to_string_lossy().to_string(),
                dest: dest.to_string_lossy().to_string(),
                bytes: None,
                file_count: None,
                skipped: true,
                skip_reason: Some("Source directory does not exist (nothing to migrate for this leg).".to_string()),
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

    if active_legs == 0 && errors.is_empty() {
        errors.push("No bundle legs had an existing source directory to migrate.".to_string());
    }

    let ok = active_legs > 0 && errors.is_empty();
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
        legs: Some(plan_legs),
        running_processes: None,
    };
    attach_running_process_warning(&mut plan, tool);
    plan
}

pub fn plan(tool: ToolId, dest_root: &Path, include_size: bool) -> MigrationPlan {
    if tool.is_bundle() {
        return plan_bundle(tool, dest_root, include_size);
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
                legs: None,
                running_processes: None,
            };
        }
    };
    let dest = dest_root.join(dest_leaf(&tool));
    plan_paths(tool.wire(), source, dest, include_size, plan_only)
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

    if let Some(msg) = blocked_source(&source) {
        errors.push(msg);
    }
    if let Some(msg) = dest_requires_ntfs_error(&dest) {
        errors.push(msg);
    }
    if !source.is_dir() {
        errors.push(format!(
            "Source does not exist or is not a directory: {}",
            source.display()
        ));
    }
    if is_under(&dest, &source) {
        errors.push("Destination is inside source; refusing.".to_string());
    }
    if is_under(&source, &dest) {
        errors.push("Source is inside destination; refusing.".to_string());
    }
    if let Ok(meta) = fs::symlink_metadata(&source) {
        if meta.file_type().is_symlink() {
            errors.push(format!(
                "Refusing to migrate a symlink/junction source without explicit override: {}",
                source.display()
            ));
        }
    }

    let (bytes, file_count) = if include_size && errors.is_empty() {
        let (b, f, w) = estimate_tree(&source);
        warnings.extend(w.into_iter().take(8));
        (b, f)
    } else {
        (None, None)
    };

    let mut plan = MigrationPlan {
        ok: errors.is_empty(),
        tool: tool_wire.to_string(),
        source: source.to_string_lossy().to_string(),
        dest: dest.to_string_lossy().to_string(),
        bytes,
        file_count,
        warnings,
        errors,
        plan_only,
        legs: None,
        running_processes: None,
    };
    if let Ok(id) = ToolId::parse(tool_wire) {
        attach_running_process_warning(&mut plan, id);
    }
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

    let resolved = fs::canonicalize(source)
        .map_err(|e| format!("failed verifying junction (canonicalize): {e}"))?;
    let expected = fs::canonicalize(dest).map_err(|e| format!("failed canonicalize dest: {e}"))?;
    if resolved.to_string_lossy().to_lowercase() != expected.to_string_lossy().to_lowercase() {
        rollback();
        return Err(format!(
            "junction verification failed: {} -> {} (expected {})",
            source.display(),
            resolved.display(),
            expected.display()
        ));
    }

    fs::remove_dir_all(&backup)
        .map_err(|e| format!("failed removing backup: {} ({e})", backup.display()))?;
    Ok(None)
}

fn run_bundle_from_plan(plan: MigrationPlan, copy_only: bool, audit_dir: &Path) -> MigrationResult {
    let warnings = plan.warnings.clone();
    let mut errors = plan.errors.clone();
    let legs = plan.legs.unwrap_or_default();
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

    let backup_path_out: Option<String> = None;

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

    let result = execute_migration_leg(&source, &dest, copy_only).map(|_| ());

    match result {
        Ok(()) => {
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
}

