use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
#[cfg(windows)]
use std::process::Command;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum ToolId {
    Cursor,
    Vscode,
    DockerDesktop,
}

impl ToolId {
    pub fn parse(s: &str) -> Result<Self, String> {
        match s.trim().to_lowercase().as_str() {
            "cursor" => Ok(Self::Cursor),
            "vscode" => Ok(Self::Vscode),
            "docker-desktop" => Ok(Self::DockerDesktop),
            other => Err(format!("unknown tool id: {other}")),
        }
    }

    pub fn wire(&self) -> &'static str {
        match self {
            ToolId::Cursor => "cursor",
            ToolId::Vscode => "vscode",
            ToolId::DockerDesktop => "docker-desktop",
        }
    }
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
fn default_source(tool: &ToolId) -> Result<PathBuf, String> {
    let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA is not set".to_string())?;
    let local = std::env::var("LOCALAPPDATA").ok();
    let p = match tool {
        ToolId::Cursor => PathBuf::from(appdata).join("Cursor"),
        ToolId::Vscode => PathBuf::from(appdata).join("Code"),
        // Docker Desktop storage is complex (WSL VHDX + ProgramData). This default is only guidance.
        ToolId::DockerDesktop => {
            let local = local.ok_or_else(|| "LOCALAPPDATA is not set".to_string())?;
            PathBuf::from(local).join("Docker")
        }
    };
    Ok(p)
}

#[cfg(not(windows))]
fn default_source(_tool: &ToolId) -> Result<PathBuf, String> {
    Err("Tool migration is Windows-only in v0.9.0.".to_string())
}

fn dest_leaf(tool: &ToolId) -> &'static str {
    match tool {
        ToolId::Cursor => "Cursor",
        ToolId::Vscode => "Code",
        ToolId::DockerDesktop => "Docker",
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
    Some("Tool migration is Windows-only in v0.9.0.".to_string())
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

pub fn plan(tool: ToolId, dest_root: &Path, include_size: bool) -> MigrationPlan {
    let plan_only = matches!(tool, ToolId::DockerDesktop);
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
        warnings.push(
            "Docker Desktop migration is plan-only in v0.9.0 (WSL/VHDX safety constraints)."
                .to_string(),
        );
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

    MigrationPlan {
        ok: errors.is_empty(),
        tool: tool_wire.to_string(),
        source: source.to_string_lossy().to_string(),
        dest: dest.to_string_lossy().to_string(),
        bytes,
        file_count,
        warnings,
        errors,
        plan_only,
    }
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

pub fn run_from_plan(plan: MigrationPlan, copy_only: bool, audit_dir: &Path) -> MigrationResult {
    let mut warnings = plan.warnings.clone();
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
        };
    }
    if plan.plan_only {
        errors.push("This tool is plan-only in v0.9.0.".to_string());
        return MigrationResult {
            ok: false,
            tool: plan.tool,
            source: plan.source,
            dest: plan.dest,
            audit_log_path: None,
            backup_path: None,
            warnings,
            errors,
        };
    }

    let source = PathBuf::from(&plan.source);
    let dest = PathBuf::from(&plan.dest);

    let stamp = now_stamp();
    let backup = PathBuf::from(format!("{}.deco-backup-{}", plan.source, stamp));
    let audit_path = audit_dir.join(format!("migration-{}.json", stamp));

    let mut backup_path_out: Option<String> = None;

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

    let result = (|| -> Result<(), String> {
        if let Some(parent) = dest.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("failed creating dest parent: {} ({e})", parent.display()))?;
        }
        if dest.exists() {
            let empty = fs::read_dir(&dest)
                .map_err(|e| format!("failed reading dest: {} ({e})", dest.display()))?
                .next()
                .is_none();
            if !empty {
                return Err(format!("Destination exists and is not empty: {}", dest.display()));
            }
        } else {
            fs::create_dir_all(&dest)
                .map_err(|e| format!("failed creating dest: {} ({e})", dest.display()))?;
        }

        let copy_warnings = copy_tree(&source, &dest)?;
        warnings.extend(copy_warnings.into_iter().take(12));

        if copy_only {
            return Ok(());
        }

        fs::rename(&source, &backup)
            .map_err(|e| format!("failed renaming source to backup: {e}"))?;
        backup_path_out = Some(backup.to_string_lossy().to_string());

        mklink_junction(&source, &dest)?;

        // Verify junction resolves to the target.
        let resolved = fs::canonicalize(&source)
            .map_err(|e| format!("failed verifying junction (canonicalize): {e}"))?;
        let expected = fs::canonicalize(&dest)
            .map_err(|e| format!("failed canonicalize dest: {e}"))?;
        if resolved.to_string_lossy().to_lowercase() != expected.to_string_lossy().to_lowercase() {
            return Err(format!(
                "junction verification failed: {} -> {} (expected {})",
                source.display(),
                resolved.display(),
                expected.display()
            ));
        }

        // Remove backup after verification.
        fs::remove_dir_all(&backup)
            .map_err(|e| format!("failed removing backup: {} ({e})", backup.display()))?;
        backup_path_out = None;

        Ok(())
    })();

    match result {
        Ok(()) => {
            ok = true;
        }
        Err(e) => {
            errors.push(e);
            // Rollback best-effort:
            if !copy_only {
                let _ = fs::remove_dir_all(&source);
                if backup.exists() {
                    if let Err(e) = fs::rename(&backup, &source) {
                        warnings.push(format!("Rollback warning: failed restoring backup: {e}"));
                    }
                }
            }
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

