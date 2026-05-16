use crate::engine::types::Settings;
use std::path::{Path, PathBuf};

/// How scan roots are chosen when settings are empty or the user resets defaults.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScanScope {
    Projects,
    Drives,
    All,
}

impl ScanScope {
    pub fn parse(value: &str) -> Self {
        match value.trim().to_lowercase().as_str() {
            "projects" => Self::Projects,
            "drives" => Self::Drives,
            _ => Self::All,
        }
    }
}

fn user_home() -> Option<PathBuf> {
    if cfg!(windows) {
        std::env::var_os("USERPROFILE").map(PathBuf::from)
    } else {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

const PROJECT_DIR_NAMES: &[&str] = &[
    "Projects",
    "projects",
    "source",
    "src",
    "dev",
    "code",
    "workspace",
    "repos",
    "Documents/GitHub",
    "Documents/projects",
    "Documents/dev",
    "Developer",
];

/// Common dev folders under the user profile (for suggest/CLI scope only).
pub fn project_scan_roots() -> Vec<String> {
    let Some(home) = user_home() else {
        return vec![];
    };

    let mut roots = Vec::new();
    for name in PROJECT_DIR_NAMES {
        let path = home.join(name);
        push_if_dir(&mut roots, &path);
    }
    // Do not add the entire home directory — too broad and usually on C:.
    dedupe_existing_roots(roots)
}

/// Drive letter from a mount (`C:\`) or path prefix.
pub fn volume_letter_of(mount_or_path: &str) -> Option<char> {
    let s = mount_or_path.trim();
    if s.len() >= 2 && s.as_bytes()[1] == b':' {
        return Some(char::from(s.as_bytes()[0].to_ascii_uppercase()));
    }
    None
}

/// True when `path` lies on the given volume mount (e.g. `D:\foo` on `D:\`).
pub fn path_on_volume(path: &str, volume_mount: &str) -> bool {
    let Some(vol_ch) = volume_letter_of(volume_mount) else {
        return false;
    };
    let Some(path_ch) = volume_letter_of(path) else {
        return false;
    };
    vol_ch == path_ch
}

/// True when `path` is on any of the selected volume mounts.
pub fn path_on_selected_volumes(path: &str, selected_volumes: &[String]) -> bool {
    selected_volumes
        .iter()
        .any(|vol| path_on_volume(path, vol))
}

/// Fixed drive letters on Windows, or `/` + mount points elsewhere.
pub fn drive_scan_roots() -> Vec<String> {
    #[cfg(windows)]
    {
        let mut roots = Vec::new();
        for letter in b'A'..=b'Z' {
            let root = format!("{}:\\", letter as char);
            let path = Path::new(&root);
            if path.exists() {
                roots.push(root);
            }
        }
        return dedupe_existing_roots(roots);
    }

    #[cfg(not(windows))]
    {
        let mut roots = vec!["/".to_string()];
        if let Some(home) = user_home() {
            push_if_dir(&mut roots, &home);
            for mount in ["/mnt", "/media"] {
                let p = Path::new(mount);
                if p.is_dir() {
                    if let Ok(entries) = std::fs::read_dir(p) {
                        for entry in entries.flatten() {
                            push_if_dir(&mut roots, &entry.path());
                        }
                    }
                }
            }
        }
        dedupe_existing_roots(roots)
    }
}

/// Suggested roots for partition-wide discovery (projects + drives).
pub fn suggest_scan_roots(scope: ScanScope) -> Vec<String> {
    let mut roots = Vec::new();
    match scope {
        ScanScope::Projects => roots.extend(project_scan_roots()),
        ScanScope::Drives => roots.extend(drive_scan_roots()),
        ScanScope::All => {
            roots.extend(project_scan_roots());
            roots.extend(drive_scan_roots());
        }
    }
    dedupe_existing_roots(roots)
}

/// True when `path` is a drive mount (e.g. `C:\` or `D:`) — not a project subfolder.
pub fn is_volume_mount(path: &str) -> bool {
    let trimmed = path.trim().trim_end_matches(['\\', '/']);
    #[cfg(windows)]
    {
        let bytes = trimmed.as_bytes();
        return bytes.len() == 2 && bytes[0].is_ascii_alphabetic() && bytes[1] == b':';
    }
    #[cfg(not(windows))]
    {
        trimmed == "/" || trimmed.starts_with("/mnt/") || trimmed.starts_with("/media/")
    }
}

/// Drive-letter roots are expanded to dev-relevant subfolders (Users\…\Projects, D:\code, …)
/// instead of walking the entire volume like TreeSize would.
#[cfg(windows)]
fn normalized_volume_root_windows(mount: &str) -> String {
    let trimmed = mount.trim().trim_end_matches(['\\', '/']);
    if trimmed.len() >= 2 && trimmed.as_bytes()[1] == b':' {
        format!(
            "{}:\\",
            char::from(trimmed.as_bytes()[0].to_ascii_uppercase())
        )
    } else {
        mount.trim().to_string()
    }
}

pub fn expand_volume_to_scan_roots(mount: &str, include_user_dev_profiles: bool) -> Vec<String> {
    if !is_volume_mount(mount) {
        return vec![mount.to_string()];
    }

    #[cfg(windows)]
    let mount_normalized = normalized_volume_root_windows(mount);
    #[cfg(not(windows))]
    let mount_normalized = {
        let t = mount.trim();
        if t == "/" {
            "/".to_string()
        } else {
            t.trim_end_matches('/').to_string()
        }
    };

    let mount_path = Path::new(&mount_normalized);
    if !mount_path.is_dir() {
        return vec![];
    }

    let mut roots = Vec::new();

    if include_user_dev_profiles {
        let users = mount_path.join("Users");
        if users.is_dir() {
            if let Ok(entries) = std::fs::read_dir(&users) {
                for entry in entries.flatten() {
                    let user_path = entry.path();
                    if !user_path.is_dir() {
                        continue;
                    }
                    let name = entry.file_name().to_string_lossy().to_lowercase();
                    if matches!(
                        name.as_str(),
                        "public" | "default" | "default user" | "all users"
                    ) {
                        continue;
                    }
                    for proj in PROJECT_DIR_NAMES {
                        push_if_dir(&mut roots, &user_path.join(proj));
                    }
                }
            }
        }
    }

    for name in [
        "Projects",
        "projects",
        "dev",
        "code",
        "repos",
        "workspace",
        "src",
        "Development",
        "Developer",
        "GitHub",
    ] {
        push_if_dir(&mut roots, &mount_path.join(name));
    }

    // Fallback: some drives have an empty or minimal Users\ — still add it for profile-style trees.
    if roots.is_empty() {
        push_if_dir(&mut roots, &mount_path.join("Users"));
    }

    // Windows: projects often live at `D:\Experimental projects\...`, not under Users\.
    // If we only scanned Users\, those trees would be invisible (0 items in 5s).
    #[cfg(windows)]
    {
        let mount_trim = mount_normalized.trim_end_matches('\\').to_uppercase();
        let has_volume_root = roots.iter().any(|r| {
            r.trim_end_matches('\\').to_uppercase() == mount_trim
        });
        if !has_volume_root {
            roots.push(mount_normalized.clone());
        }
    }

    #[cfg(not(windows))]
    if roots.is_empty() {
        roots.push(mount_path.to_string_lossy().to_string());
    }

    roots
}

/// Build scan roots from partition selection + optional project folders.
/// At least one partition must be selected; dev folders alone are not enough.
pub fn effective_scan_roots(settings: &Settings) -> Vec<String> {
    if settings.selected_volumes.is_empty() {
        return vec![];
    }
    let mut roots = Vec::new();
    let include_profiles = settings.include_project_folders;
    for vol in &settings.selected_volumes {
        roots.extend(expand_volume_to_scan_roots(vol, include_profiles));
    }
    // Only scan selected volumes — never pull in %USERPROFILE% on C: when D/E are selected.
    let roots: Vec<String> = roots
        .into_iter()
        .filter(|r| path_on_selected_volumes(r, &settings.selected_volumes))
        .collect();
    dedupe_existing_roots(roots)
}

fn push_if_dir(out: &mut Vec<String>, path: &Path) {
    if path.is_dir() {
        out.push(path.to_string_lossy().to_string());
    }
}

fn dedupe_existing_roots(roots: Vec<String>) -> Vec<String> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for r in roots {
        let path = Path::new(&r);
        if !path.is_dir() {
            continue;
        }
        let key = std::fs::canonicalize(path)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| r.clone());
        let norm = if cfg!(windows) {
            key.to_lowercase()
        } else {
            key
        };
        if seen.insert(norm) {
            out.push(r);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::types::Settings;
    use std::path::Path;

    fn resolve_scan_roots(
        requested: &[String],
        settings_roots: &[String],
        scope: ScanScope,
    ) -> Vec<String> {
        let raw = if !requested.is_empty() {
            requested.to_vec()
        } else if !settings_roots.is_empty() {
            settings_roots.to_vec()
        } else {
            suggest_scan_roots(scope)
        };
        super::dedupe_existing_roots(raw)
    }

    #[test]
    fn suggest_all_includes_home_or_drives() {
        let roots = suggest_scan_roots(ScanScope::All);
        assert!(!roots.is_empty(), "expected at least one scan root");
    }

    #[test]
    fn resolve_prefers_explicit_roots() {
        let explicit = vec![std::env::temp_dir().to_string_lossy().to_string()];
        let resolved = resolve_scan_roots(&explicit, &["D:\\other".to_string()], ScanScope::All);
        assert_eq!(resolved, explicit);
    }

    #[test]
    fn scope_parse() {
        assert_eq!(ScanScope::parse("projects"), ScanScope::Projects);
        assert_eq!(ScanScope::parse("DRIVES"), ScanScope::Drives);
        assert_eq!(ScanScope::parse(""), ScanScope::All);
    }

    #[cfg(windows)]
    #[test]
    fn expand_volume_always_includes_drive_root_for_data_drive_layout() {
        let expanded = expand_volume_to_scan_roots(r"C:\", false);
        assert!(
            expanded.iter().any(|r| r.trim_end_matches('\\').to_uppercase() == "C:"),
            "volume root must be included so non-Users trees are scanned: {expanded:?}"
        );
    }

    #[cfg(windows)]
    #[test]
    fn is_volume_mount_detects_drive_letters() {
        assert!(is_volume_mount(r"C:\"));
        assert!(is_volume_mount("D:"));
        assert!(!is_volume_mount(r"C:\Projects"));
    }

    #[cfg(not(windows))]
    #[test]
    fn is_volume_mount_detects_unix_mounts() {
        assert!(is_volume_mount("/"));
        assert!(is_volume_mount("/mnt/wsl"));
        assert!(is_volume_mount("/media/usb"));
        assert!(!is_volume_mount("/home/user/projects"));
    }

    #[cfg(windows)]
    #[test]
    fn expand_volume_never_empty_on_existing_os_drive() {
        let expanded = expand_volume_to_scan_roots(r"C:\", false);
        assert!(!expanded.is_empty(), "{expanded:?}");
    }

    #[cfg(windows)]
    #[test]
    fn effective_roots_non_empty_when_dev_folders_disabled_if_extra_drives_exist() {
        let mut volumes = Vec::new();
        for letter in [b'D', b'E'] {
            let mount = format!("{}:\\", letter as char);
            if Path::new(&mount).is_dir() {
                volumes.push(mount);
            }
        }
        if volumes.is_empty() {
            return;
        }
        let settings = Settings {
            selected_volumes: volumes,
            include_project_folders: false,
            ..Settings::default()
        };
        let roots = effective_scan_roots(&settings);
        assert!(!roots.is_empty(), "{roots:?}");
    }

    #[cfg(windows)]
    #[test]
    fn effective_roots_only_on_selected_volumes() {
        let settings = Settings {
            selected_volumes: vec!["D:\\".to_string(), "E:\\".to_string()],
            include_project_folders: true,
            ..Settings::default()
        };
        let roots = effective_scan_roots(&settings);
        if roots.is_empty() {
            return;
        }
        assert!(
            roots.iter().all(|r| {
                let u = r.to_uppercase();
                u.starts_with("D:\\") || u.starts_with("E:\\")
            }),
            "expected only D: and E: roots, got {roots:?}"
        );
    }

    #[test]
    fn path_on_volume_matches_drive() {
        assert!(path_on_volume(
            r"C:\Users\Admin\Projects",
            r"C:\"
        ));
        assert!(!path_on_volume(
            r"C:\Users\Admin\Projects",
            r"D:\"
        ));
    }
}
