use std::path::{Path, PathBuf};
use std::process::Command;

/// Open a folder (or reveal a file) in the system file manager.
#[tauri::command]
pub fn reveal_path_in_explorer(path: String) -> Result<(), String> {
    let path = PathBuf::from(path.trim());
    if path.as_os_str().is_empty() {
        return Err("Path is empty.".to_string());
    }

    let target = if path.exists() {
        path
    } else if let Some(parent) = path.parent() {
        if parent.as_os_str().is_empty() {
            return Err(format!("Path does not exist: {}", path.display()));
        }
        parent.to_path_buf()
    } else {
        return Err(format!("Path does not exist: {}", path.display()));
    };

    reveal_in_file_manager(&target).map_err(|e| format!("Failed to open in file manager: {e}"))
}

#[cfg(windows)]
fn reveal_in_file_manager(path: &Path) -> std::io::Result<()> {
    let path_str = path.to_string_lossy();
    if path.is_dir() {
        Command::new("explorer").arg(path_str.as_ref()).spawn()?;
    } else {
        Command::new("explorer")
            .args(["/select,", path_str.as_ref()])
            .spawn()?;
    }
    Ok(())
}

#[cfg(target_os = "macos")]
fn reveal_in_file_manager(path: &Path) -> std::io::Result<()> {
    let path_str = path.to_string_lossy();
    Command::new("open").arg("-R").arg(path_str.as_ref()).spawn()?;
    Ok(())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn reveal_in_file_manager(path: &Path) -> std::io::Result<()> {
    let path_str = path.to_string_lossy();
    Command::new("xdg-open").arg(path_str.as_ref()).spawn()?;
    Ok(())
}
