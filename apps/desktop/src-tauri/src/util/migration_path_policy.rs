//! Blocklist for custom directory migration on Windows.
//!
//! Blocks system directories and overly broad profile roots (entire `Documents`, `AppData`, …)
//! while allowing specific user folders such as
//! `Documents\Electronic Arts\The Sims 4\Mods`.

use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MigrationPathRole {
    Source,
    Dest,
}

fn norm(path: &Path) -> String {
    path.to_string_lossy().replace('/', "\\").to_lowercase()
}

fn is_under(child: &Path, parent: &Path) -> bool {
    let c = norm(child);
    let p = norm(parent).trim_end_matches('\\').to_string();
    if c == p {
        return true;
    }
    c.starts_with(&(p + "\\"))
}

fn drive_root(path: &Path) -> bool {
    let s = norm(path);
    s.len() <= 3 && s.ends_with(":\\")
}

#[cfg(windows)]
fn system_prefixes() -> Vec<PathBuf> {
    vec![
        PathBuf::from(std::env::var("SystemRoot").unwrap_or_else(|_| "C:\\Windows".to_string())),
        PathBuf::from(std::env::var("ProgramFiles").unwrap_or_else(|_| "C:\\Program Files".to_string())),
        PathBuf::from(
            std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| "C:\\Program Files (x86)".to_string()),
        ),
        PathBuf::from(std::env::var("ProgramData").unwrap_or_else(|_| "C:\\ProgramData".to_string())),
    ]
}

#[cfg(windows)]
fn profile_root_blocklist() -> Vec<PathBuf> {
    let Some(profile) = std::env::var("USERPROFILE").ok().map(PathBuf::from) else {
        return Vec::new();
    };
    [
        profile.clone(),
        profile.join("AppData"),
        profile.join("AppData").join("Roaming"),
        profile.join("AppData").join("Local"),
        profile.join("AppData").join("LocalLow"),
        profile.join("Documents"),
        profile.join("Desktop"),
        profile.join("Downloads"),
        profile.join("Music"),
        profile.join("Pictures"),
        profile.join("Videos"),
        profile.join("OneDrive"),
    ]
    .into_iter()
    .collect()
}

/// When `Some`, migration must not use this path for the given role.
pub fn migration_path_block_reason(path: &Path, role: MigrationPathRole) -> Option<String> {
    let display = path.display();
    let role_label = match role {
        MigrationPathRole::Source => "source",
        MigrationPathRole::Dest => "destination",
    };

    if drive_root(path) {
        return Some(format!("Refusing to use drive root as migration {role_label}: {display}"));
    }

    #[cfg(windows)]
    {
        for prefix in system_prefixes() {
            if is_under(path, &prefix) {
                return Some(format!(
                    "Refusing to use a path under system directory {} as migration {role_label}: {display}",
                    prefix.display()
                ));
            }
        }

        for blocked in profile_root_blocklist() {
            if norm(path) == norm(&blocked) {
                return Some(format!(
                    "Refusing to migrate an entire profile root ({blocked}). Pick a specific subfolder — \
                     e.g. Documents\\Electronic Arts\\The Sims 4\\Mods instead of all of Documents.",
                    blocked = blocked.display()
                ));
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = role;
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drive_root_blocked() {
        assert!(migration_path_block_reason(Path::new(r"C:\"), MigrationPathRole::Source).is_some());
    }

    #[cfg(windows)]
    #[test]
    fn sims_mods_path_allowed_when_profile_set() {
        let Some(profile) = std::env::var("USERPROFILE").ok() else {
            return;
        };
        let mods = PathBuf::from(&profile)
            .join("Documents")
            .join("Electronic Arts")
            .join("The Sims 4")
            .join("Mods");
        assert!(migration_path_block_reason(&mods, MigrationPathRole::Source).is_none());
    }

    #[cfg(windows)]
    #[test]
    fn entire_documents_blocked() {
        let Some(profile) = std::env::var("USERPROFILE").ok() else {
            return;
        };
        let docs = PathBuf::from(profile).join("Documents");
        assert!(migration_path_block_reason(&docs, MigrationPathRole::Source).is_some());
    }

    #[cfg(windows)]
    #[test]
    fn appdata_roaming_subfolder_allowed() {
        let Some(profile) = std::env::var("USERPROFILE").ok() else {
            return;
        };
        let cursor = PathBuf::from(profile)
            .join("AppData")
            .join("Roaming")
            .join("obs-studio");
        assert!(migration_path_block_reason(&cursor, MigrationPathRole::Source).is_none());
    }

    #[cfg(windows)]
    #[test]
    fn entire_appdata_roaming_blocked() {
        let Some(profile) = std::env::var("USERPROFILE").ok() else {
            return;
        };
        let roaming = PathBuf::from(profile).join("AppData").join("Roaming");
        assert!(migration_path_block_reason(&roaming, MigrationPathRole::Source).is_some());
    }
}
