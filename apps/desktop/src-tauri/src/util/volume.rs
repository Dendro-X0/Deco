use std::path::{Path, PathBuf};
#[cfg(unix)]
use std::path::Component;

/// Windows `C:\` or `E:/` prefix (parsed on all platforms for Windows-style path strings).
fn windows_drive_root(raw: &str) -> Option<PathBuf> {
    let bytes = raw.as_bytes();
    if bytes.len() >= 2 && bytes[1] == b':' {
        let letter = bytes[0] as char;
        if letter.is_ascii_alphabetic() {
            return Some(PathBuf::from(format!("{}:\\", letter.to_ascii_uppercase())));
        }
    }
    None
}

fn unc_share_root(raw: &str) -> Option<PathBuf> {
    if !raw.starts_with(r"\\") && !raw.starts_with("//") {
        return None;
    }
    let trimmed = raw.trim_start_matches('\\').trim_start_matches('/');
    let parts: Vec<&str> = trimmed.split(['\\', '/']).filter(|p| !p.is_empty()).collect();
    if parts.len() >= 2 {
        return Some(PathBuf::from(format!(r"\\{}\{}", parts[0], parts[1])));
    }
    None
}

fn absolutize(path: &Path) -> PathBuf {
    if path.is_absolute() {
        path.to_path_buf()
    } else if let Ok(cwd) = std::env::current_dir() {
        cwd.join(path)
    } else {
        path.to_path_buf()
    }
}

/// Writable base for per-source quarantine (`E:\` on Windows, `/Users/name` on macOS, etc.).
pub fn quarantine_volume_base(path: &Path) -> Option<PathBuf> {
    let raw = path.as_os_str().to_string_lossy();
    if let Some(drive) = windows_drive_root(&raw) {
        return Some(drive);
    }
    if let Some(unc) = unc_share_root(&raw) {
        return Some(unc);
    }

    let abs = absolutize(path);
    let abs_raw = abs.to_string_lossy();
    if let Some(drive) = windows_drive_root(&abs_raw) {
        return Some(drive);
    }
    if let Some(unc) = unc_share_root(&abs_raw) {
        return Some(unc);
    }

    #[cfg(unix)]
    {
        return unix_quarantine_base(&abs);
    }

    #[cfg(windows)]
    {
        if abs.is_absolute() {
            return windows_drive_root(&abs_raw).or_else(|| unc_share_root(&abs_raw));
        }
        None
    }
}

/// First writable prefix on Unix (avoid `/.deco-quarantine` which CI cannot create).
#[cfg(unix)]
fn unix_quarantine_base(abs: &Path) -> Option<PathBuf> {
    if !abs.is_absolute() {
        return None;
    }
    let mut base = PathBuf::new();
    let mut normal_count = 0u32;
    for comp in abs.components() {
        match comp {
            Component::RootDir | Component::Prefix(_) => {
                base.push(comp.as_os_str());
            }
            Component::Normal(name) => {
                base.push(name);
                normal_count += 1;
                let name = name.to_string_lossy();
                if normal_count >= 2 {
                    break;
                }
                if normal_count == 1 && (name == "tmp" || name == "var" || name == "private") {
                    break;
                }
            }
            Component::CurDir | Component::ParentDir => {
                base.push(comp.as_os_str());
            }
        }
    }
    if base.as_os_str().is_empty() {
        Some(PathBuf::from("/"))
    } else {
        Some(base)
    }
}

pub fn same_volume(a: &Path, b: &Path) -> bool {
    match (quarantine_volume_base(a), quarantine_volume_base(b)) {
        (Some(va), Some(vb)) => va == vb,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_style_drive_on_unix_ci() {
        let q = quarantine_volume_base(Path::new(r"E:\repo\target"));
        assert_eq!(q, Some(PathBuf::from(r"E:\")));
    }

    #[test]
    fn relative_path_resolves_against_cwd() {
        let cwd = std::env::current_dir().expect("cwd");
        let rel = Path::new(".");
        let root = quarantine_volume_base(rel).expect("volume for cwd-relative path");
        let expected = quarantine_volume_base(&cwd).expect("volume for cwd");
        assert_eq!(root, expected);
    }

    #[cfg(unix)]
    #[test]
    fn unix_quarantine_base_uses_writable_prefix() {
        let abs = Path::new("/Users/runner/work/Deco/Deco/apps/desktop/target");
        let base = unix_quarantine_base(abs).expect("base");
        assert_eq!(base, PathBuf::from("/Users/runner"));
        assert_ne!(base, PathBuf::from("/"));
    }
}
