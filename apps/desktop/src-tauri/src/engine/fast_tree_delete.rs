//! Fast removal of heavy dependency trees via OS utilities (`rmdir` / `rm -rf`).
//!
//! Used when Settings → experimental fast tree delete is on and cleanup is in-place.

use crate::util::native_path::io_path_for_delete;
use std::path::Path;

/// Remove a directory tree using the platform shell helper (no per-file Rust walk).
pub fn try_delete_tree_fast(path: &Path) -> Result<(), String> {
    let io = io_path_for_delete(path);
    if !io.is_dir() {
        return Err("path is not a directory".to_string());
    }
    #[cfg(windows)]
    return windows_rmdir(&io);
    #[cfg(not(windows))]
    return unix_rm_rf(&io);
}

#[cfg(windows)]
fn windows_rmdir(path: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    use std::process::Command;

    const CREATE_NO_WINDOW: u32 = 0x0800_0000;

    let status = Command::new("cmd")
        .arg("/C")
        .arg("rmdir")
        .arg("/s")
        .arg("/q")
        .arg(path)
        .creation_flags(CREATE_NO_WINDOW)
        .status()
        .map_err(|e| format!("spawn rmdir failed: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("rmdir /s /q failed ({status})"))
    }
}

#[cfg(not(windows))]
fn unix_rm_rf(path: &Path) -> Result<(), String> {
    use std::process::Command;

    let status = Command::new("rm")
        .arg("-rf")
        .arg(path)
        .status()
        .map_err(|e| format!("spawn rm failed: {e}"))?;

    if status.success() {
        Ok(())
    } else {
        Err(format!("rm -rf failed ({status})"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(name: &str) -> std::path::PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("deco-fast-delete-{name}-{nanos}"))
    }

    fn write_nested_tree(root: &Path, depth: u32) {
        fs::create_dir_all(root).expect("mkdir");
        fs::write(root.join("leaf.txt"), b"x").expect("write");
        if depth == 0 {
            return;
        }
        write_nested_tree(&root.join("child"), depth - 1);
    }

    #[test]
    fn fast_delete_removes_nested_directory() {
        let root = unique_temp_dir("nested");
        write_nested_tree(&root, 4);
        assert!(root.is_dir());

        try_delete_tree_fast(&root).expect("fast delete");
        assert!(!root.exists());
    }
}
