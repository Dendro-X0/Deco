//! Resolve Windows profile folders when `APPDATA` / `LOCALAPPDATA` are missing or wrong
//! (common when a GUI app is launched without a full user environment block).

use std::path::{Path, PathBuf};

pub fn user_profile_dir() -> Option<PathBuf> {
    std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(PathBuf::from)
}

/// `%APPDATA%` or `%USERPROFILE%\AppData\Roaming`.
pub fn roaming_appdata_dir() -> Result<PathBuf, String> {
    if let Ok(v) = std::env::var("APPDATA") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    let profile = user_profile_dir().ok_or_else(|| "USERPROFILE is not set".to_string())?;
    Ok(profile.join("AppData").join("Roaming"))
}

/// `%LOCALAPPDATA%` or `%USERPROFILE%\AppData\Local`.
pub fn local_appdata_dir() -> Result<PathBuf, String> {
    if let Ok(v) = std::env::var("LOCALAPPDATA") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            return Ok(PathBuf::from(trimmed));
        }
    }
    let profile = user_profile_dir().ok_or_else(|| "USERPROFILE is not set".to_string())?;
    Ok(profile.join("AppData").join("Local"))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SourceDirCheck {
    Ready,
    NotFound,
    NotDirectory,
    AlreadyLink,
    Inaccessible,
}

/// Whether `path` can be copied as a migration source (directory, not an existing junction).
pub fn check_migrate_source_dir(path: &Path) -> SourceDirCheck {
    let link_meta = match std::fs::symlink_metadata(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return SourceDirCheck::NotFound,
        Err(_) => return SourceDirCheck::Inaccessible,
        Ok(m) => m,
    };

    if link_meta.file_type().is_symlink() {
        return SourceDirCheck::AlreadyLink;
    }

    match std::fs::metadata(path) {
        Err(_) => SourceDirCheck::Inaccessible,
        Ok(m) if m.is_dir() => SourceDirCheck::Ready,
        Ok(_) => SourceDirCheck::NotDirectory,
    }
}

pub fn source_check_message(path: &Path, check: SourceDirCheck) -> String {
    let display = path.display();
    match check {
        SourceDirCheck::Ready => format!("{display}"),
        SourceDirCheck::NotFound => format!(
            "Source not found: {display} — confirm Cursor/VS Code has been launched at least once under this Windows user."
        ),
        SourceDirCheck::NotDirectory => format!("Source is not a directory: {display}"),
        SourceDirCheck::AlreadyLink => format!(
            "Source is already a junction/symlink: {display} — migration may have completed; verify the target drive or remove the link before re-running."
        ),
        SourceDirCheck::Inaccessible => format!(
            "Cannot read source: {display} — close the tool, check permissions, or run Deco as the same user (avoid mismatched Administrator vs normal account)."
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roaming_fallback_uses_userprofile_when_appdata_empty() {
        let profile = user_profile_dir();
        if profile.is_none() {
            return;
        }
        let base = roaming_appdata_dir().expect("roaming");
        assert!(base.ends_with("Roaming") || base.to_string_lossy().contains("AppData"));
    }
}
