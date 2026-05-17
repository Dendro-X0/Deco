use std::path::{Path, PathBuf};

/// Drive root for quarantine placement (`E:\` on Windows, `/` on Unix).
pub fn volume_root(path: &Path) -> Option<PathBuf> {
    #[cfg(windows)]
    {
        let raw = path.as_os_str().to_string_lossy();
        let bytes = raw.as_bytes();
        if bytes.len() >= 2 && bytes[1] == b':' {
            let letter = bytes[0] as char;
            if letter.is_ascii_alphabetic() {
                return Some(PathBuf::from(format!("{}:\\", letter.to_ascii_uppercase())));
            }
        }
        if raw.starts_with(r"\\") {
            let parts: Vec<&str> = raw.trim_start_matches('\\').split('\\').collect();
            if parts.len() >= 2 {
                return Some(PathBuf::from(format!(r"\\{}\{}", parts[0], parts[1])));
            }
        }
        return None;
    }
    #[cfg(not(windows))]
    {
        if path.is_absolute() {
            return Some(PathBuf::from("/"));
        }
        None
    }
}

pub fn same_volume(a: &Path, b: &Path) -> bool {
    match (volume_root(a), volume_root(b)) {
        (Some(va), Some(vb)) => va == vb,
        _ => false,
    }
}
