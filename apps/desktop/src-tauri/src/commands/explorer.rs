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

/// Open an https URL in the system browser (release notes, download links).
#[tauri::command]
pub fn open_url(url: String) -> Result<(), String> {
    let url = url.trim();
    if !url.starts_with("https://") {
        return Err("Only https URLs are allowed.".to_string());
    }
    open_in_browser(url).map_err(|e| format!("Failed to open URL: {e}"))
}

fn open_in_browser(url: &str) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        Command::new("cmd")
            .args(["/C", "start", "", url])
            .spawn()?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(url).spawn()?;
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        Command::new("xdg-open").arg(url).spawn()?;
    }
    Ok(())
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
