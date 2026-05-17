use std::path::{Path, PathBuf};

/// Windows extended-length path (`\\?\`) for deep `node_modules` trees (>260 chars).
#[cfg(windows)]
pub fn io_path(path: &Path) -> PathBuf {
    let raw = path.as_os_str().to_string_lossy();
    if raw.starts_with(r"\\?\") {
        return path.to_path_buf();
    }
    if let Ok(abs) = std::fs::canonicalize(path) {
        let abs_raw = abs.as_os_str().to_string_lossy();
        if abs_raw.starts_with(r"\\?\") {
            return abs;
        }
        if abs_raw.starts_with(r"\\") {
            let trimmed = abs_raw.trim_start_matches('\\');
            return PathBuf::from(format!(r"\\?\UNC\{trimmed}"));
        }
        return PathBuf::from(format!(r"\\?\{}", abs_raw));
    }
    path.to_path_buf()
}

#[cfg(not(windows))]
pub fn io_path(path: &Path) -> PathBuf {
    path.to_path_buf()
}
