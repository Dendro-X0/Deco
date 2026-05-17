use std::path::{Path, PathBuf};

/// Windows `C:\` or `E:\` prefix (parsed on all platforms for Windows-style path strings).
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

/// Drive root for quarantine placement (`E:\` on Windows, `/` on Unix).
pub fn volume_root(path: &Path) -> Option<PathBuf> {
    let abs = absolutize(path);
    let raw = abs.to_string_lossy();

    if let Some(drive) = windows_drive_root(&raw) {
        return Some(drive);
    }

    if let Some(unc) = unc_share_root(&raw) {
        return Some(unc);
    }

    if abs.is_absolute() {
        #[cfg(unix)]
        {
            return Some(PathBuf::from("/"));
        }
        #[cfg(windows)]
        {
            return None;
        }
    }

    None
}

pub fn same_volume(a: &Path, b: &Path) -> bool {
    match (volume_root(a), volume_root(b)) {
        (Some(va), Some(vb)) => va == vb,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn windows_style_drive_on_unix_ci() {
        let root = volume_root(Path::new(r"E:\repo\target"));
        assert_eq!(root, Some(PathBuf::from(r"E:\")));
    }

    #[test]
    fn relative_path_resolves_against_cwd() {
        let cwd = std::env::current_dir().expect("cwd");
        let rel = Path::new(".");
        let root = volume_root(rel).expect("volume for cwd-relative path");
        let expected = volume_root(&cwd).expect("volume for cwd");
        assert_eq!(root, expected);
    }
}
