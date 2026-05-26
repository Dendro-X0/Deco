//! Remove stale Deco desktop shortcuts after upgrades (Windows).

use std::path::{Path, PathBuf};

const PRODUCT_NAME: &str = "Deco";

/// Best-effort cleanup of duplicate or broken Deco `.lnk` files on the user and public desktop.
#[cfg(windows)]
pub fn prune_stale_deco_desktop_shortcuts() {
    let current_exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };
    let current_exe = match fs_canonicalize(&current_exe) {
        Some(p) => p,
        None => current_exe,
    };

    let mut desktops: Vec<PathBuf> = Vec::new();
    if let Ok(profile) = std::env::var("USERPROFILE") {
        desktops.push(PathBuf::from(profile).join("Desktop"));
    }
    desktops.push(PathBuf::from(r"C:\Users\Public\Desktop"));

    let mut kept_current = false;
    for desktop in desktops {
        let Ok(entries) = std::fs::read_dir(&desktop) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("lnk") {
                continue;
            }
            let Some(stem) = path.file_stem().and_then(|s| s.to_str()) else {
                continue;
            };
            if !stem.eq_ignore_ascii_case(PRODUCT_NAME) && !stem.starts_with(&format!("{PRODUCT_NAME} ")) {
                continue;
            }

            let Some(target) = read_lnk_target(&path) else {
                let _ = std::fs::remove_file(&path);
                continue;
            };
            let target = fs_canonicalize(&target).unwrap_or(target);

            let points_to_us = paths_equal_ignore_case(&target, &current_exe);
            if points_to_us {
                if kept_current {
                    let _ = std::fs::remove_file(&path);
                } else {
                    kept_current = true;
                }
            } else if is_deco_executable(&target) || !target.exists() {
                let _ = std::fs::remove_file(&path);
            }
        }
    }
}

#[cfg(windows)]
fn is_deco_executable(path: &Path) -> bool {
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|n| n.eq_ignore_ascii_case("deco-desktop.exe") || n.eq_ignore_ascii_case("deco.exe"))
        .unwrap_or(false)
}

#[cfg(windows)]
fn paths_equal_ignore_case(a: &Path, b: &Path) -> bool {
    a.to_string_lossy()
        .eq_ignore_ascii_case(&b.to_string_lossy().to_string())
}

#[cfg(windows)]
fn fs_canonicalize(path: &Path) -> Option<PathBuf> {
    std::fs::canonicalize(path).ok()
}

#[cfg(windows)]
fn read_lnk_target(lnk: &Path) -> Option<PathBuf> {
    let script = format!(
        r#"$s = (New-Object -ComObject WScript.Shell).CreateShortcut('{}'); $s.TargetPath"#,
        lnk.to_string_lossy().replace('\'', "''")
    );
    let output = std::process::Command::new("powershell")
        .args([
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            &script,
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return None;
    }
    Some(PathBuf::from(text))
}

#[cfg(not(windows))]
pub fn prune_stale_deco_desktop_shortcuts() {}
