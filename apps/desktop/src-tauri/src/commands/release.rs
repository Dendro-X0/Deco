//! Download GitHub release assets into the user Downloads folder and launch installers.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::AppHandle;
use tauri::Manager;

#[derive(Serialize)]
#[serde(rename_all = "lowercase")]
pub struct AppPlatform {
    pub os: &'static str,
    pub arch: &'static str,
}

#[tauri::command]
pub fn get_app_platform() -> AppPlatform {
    #[cfg(target_os = "windows")]
    let os = "windows";
    #[cfg(target_os = "macos")]
    let os = "macos";
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    let os = "linux";

    let arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        std::env::consts::ARCH
    };

    AppPlatform { os, arch }
}

fn validate_release_download_url(url: &str) -> Result<(), String> {
    let parsed = url::Url::parse(url.trim()).map_err(|_| "Invalid download URL.".to_string())?;
    if parsed.scheme() != "https" {
        return Err("Only https download URLs are allowed.".to_string());
    }
    match parsed.host_str() {
        Some("github.com") => {
            if parsed.path().contains("/releases/download/") {
                Ok(())
            } else {
                Err("GitHub URL must be a release asset (…/releases/download/…).".to_string())
            }
        }
        Some(host) if host.ends_with(".githubusercontent.com") => Ok(()),
        _ => Err("Only GitHub release download URLs are allowed.".to_string()),
    }
}

fn sanitize_download_filename(name: &str) -> Result<String, String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err("Filename is empty.".to_string());
    }
    if trimmed.contains('/') || trimmed.contains('\\') || trimmed.contains("..") {
        return Err("Invalid filename.".to_string());
    }
    if !trimmed.chars().all(|c| {
        c.is_ascii_alphanumeric() || "._-()[]+".contains(c)
    }) {
        return Err("Filename contains disallowed characters.".to_string());
    }
    Ok(trimmed.to_string())
}

fn uniquify_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let parent = path.parent().unwrap_or_else(|| Path::new("")).to_path_buf();
    let stem = path
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "download".to_string());
    let ext = path
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy()))
        .unwrap_or_default();
    for i in 2..10_000u32 {
        let candidate = parent.join(format!("{stem} ({i}){ext}"));
        if !candidate.exists() {
            return candidate;
        }
    }
    path
}

/// Downloads a release asset into the user's Downloads folder. Returns the absolute path saved.
#[tauri::command]
pub async fn download_release_asset(app: AppHandle, url: String, filename: String) -> Result<String, String> {
    validate_release_download_url(&url)?;
    let safe_name = sanitize_download_filename(&filename)?;

    let dest_dir = app
        .path()
        .download_dir()
        .map_err(|e| format!("Could not resolve Downloads folder: {e}"))?;
    std::fs::create_dir_all(&dest_dir).map_err(|e| format!("Could not create Downloads path: {e}"))?;

    let mut dest = dest_dir.join(&safe_name);
    if dest.exists() {
        dest = uniquify_path(dest);
    }

    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::limited(16))
        .timeout(std::time::Duration::from_secs(900))
        .build()
        .map_err(|e| format!("HTTP client: {e}"))?;

    let response = client
        .get(url.trim())
        .header("User-Agent", "DecoDesktop/UpdateCheck")
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: HTTP {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Download incomplete: {e}"))?;

    std::fs::write(&dest, &bytes).map_err(|e| format!("Could not save file: {e}"))?;

    dest.to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Saved path is not valid UTF-8.".to_string())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum InstallerKind {
    WindowsMsi,
    WindowsExe,
    WindowsZip,
    MacosDmg,
    MacosPkg,
    MacosZip,
    LinuxAppImage,
    LinuxDeb,
    LinuxRpm,
    LinuxZip,
    Unsupported,
}

fn file_extension_lower(path: &Path) -> String {
    path.extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn file_name_lower(path: &Path) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn current_target_os() -> &'static str {
    #[cfg(windows)]
    return "windows";
    #[cfg(target_os = "macos")]
    return "macos";
    #[cfg(all(unix, not(target_os = "macos")))]
    return "linux";
}

/// Classify an on-disk installer by **target OS** (unit-tested on Windows CI for macOS/Linux too).
pub(crate) fn installer_kind_for_target(path: &Path, target_os: &str) -> InstallerKind {
    let ext = file_extension_lower(path);
    let name = file_name_lower(path);

    match target_os {
        "windows" => match ext.as_str() {
            "msi" => InstallerKind::WindowsMsi,
            "exe" => InstallerKind::WindowsExe,
            "zip" => InstallerKind::WindowsZip,
            _ => InstallerKind::Unsupported,
        },
        "macos" => match ext.as_str() {
            "dmg" => InstallerKind::MacosDmg,
            "pkg" => InstallerKind::MacosPkg,
            "zip" => InstallerKind::MacosZip,
            _ => InstallerKind::Unsupported,
        },
        "linux" => {
            if ext == "appimage" || name.ends_with(".appimage") {
                return InstallerKind::LinuxAppImage;
            }
            match ext.as_str() {
                "deb" => InstallerKind::LinuxDeb,
                "rpm" => InstallerKind::LinuxRpm,
                "zip" => InstallerKind::LinuxZip,
                _ => InstallerKind::Unsupported,
            }
        }
        _ => InstallerKind::Unsupported,
    }
}

fn detect_installer_kind(path: &Path) -> InstallerKind {
    installer_kind_for_target(path, current_target_os())
}

fn unsupported_install_message() -> String {
    #[cfg(windows)]
    return "Unsupported file type for install on Windows (use .msi or .exe).".to_string();
    #[cfg(target_os = "macos")]
    return "Unsupported file type for install on macOS (use .dmg or .pkg).".to_string();
    #[cfg(all(unix, not(target_os = "macos")))]
    return "Unsupported Linux installer type (use .AppImage, .deb, or .rpm).".to_string();
}

/// Starts the OS-appropriate installer for a file previously saved under Downloads.
#[tauri::command]
pub fn launch_installer_for_download(path: String) -> Result<(), String> {
    let path = PathBuf::from(path.trim());
    if !path.is_file() {
        return Err("Installer file does not exist or is not a file.".to_string());
    }

    let kind = detect_installer_kind(&path);

    #[cfg(windows)]
    {
        return launch_installer_on_windows(&path, kind);
    }
    #[cfg(target_os = "macos")]
    {
        return launch_installer_on_macos(&path, kind);
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        return launch_installer_on_linux(&path, kind);
    }
}

#[cfg(windows)]
fn launch_installer_on_windows(path: &Path, kind: InstallerKind) -> Result<(), String> {
    match kind {
        InstallerKind::WindowsMsi => launch_windows_msi(path),
        InstallerKind::WindowsExe => launch_windows_exe(path),
        InstallerKind::WindowsZip => launch_windows_zip(path),
        InstallerKind::Unsupported => Err(unsupported_install_message()),
        _ => Err(unsupported_install_message()),
    }
}

#[cfg(target_os = "macos")]
fn launch_installer_on_macos(path: &Path, kind: InstallerKind) -> Result<(), String> {
    match kind {
        InstallerKind::MacosDmg | InstallerKind::MacosPkg => launch_macos_open(path),
        InstallerKind::MacosZip => launch_macos_zip(path),
        InstallerKind::Unsupported => Err(unsupported_install_message()),
        _ => Err(unsupported_install_message()),
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch_installer_on_linux(path: &Path, kind: InstallerKind) -> Result<(), String> {
    match kind {
        InstallerKind::LinuxAppImage => launch_linux_appimage(path),
        InstallerKind::LinuxDeb | InstallerKind::LinuxRpm => launch_linux_package(path),
        InstallerKind::LinuxZip => launch_linux_zip(path),
        InstallerKind::Unsupported => Err(unsupported_install_message()),
        _ => Err(unsupported_install_message()),
    }
}

#[cfg(windows)]
fn launch_windows_msi(path: &Path) -> Result<(), String> {
    Command::new("msiexec.exe")
        .args(["/i", &path.to_string_lossy()])
        .spawn()
        .map_err(|e| format!("Could not start MSI installer: {e}"))?;
    Ok(())
}

#[cfg(windows)]
fn launch_windows_exe(path: &Path) -> Result<(), String> {
    let path_str = path.to_string_lossy();
    Command::new("cmd")
        .args(["/C", "start", "", path_str.as_ref()])
        .spawn()
        .map_err(|e| format!("Could not start installer: {e}"))?;
    Ok(())
}

#[cfg(windows)]
fn launch_windows_zip(path: &Path) -> Result<(), String> {
    let path_str = path.to_string_lossy();
    Command::new("explorer")
        .args(["/select,", path_str.as_ref()])
        .spawn()
        .map_err(|e| format!("Could not open Downloads: {e}"))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn launch_macos_open(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Could not open installer: {e}"))?;
    Ok(())
}

/// `open archive.zip` on macOS hands off to Archive Utility / default handler (preferred over Finder reveal).
#[cfg(target_os = "macos")]
fn launch_macos_zip(path: &Path) -> Result<(), String> {
    Command::new("open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Could not open archive: {e}"))?;
    Ok(())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch_linux_appimage(path: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;

    let mut perms = std::fs::metadata(path)
        .map_err(|e| e.to_string())?
        .permissions();
    perms.set_mode(0o755);
    std::fs::set_permissions(path, perms).map_err(|e| e.to_string())?;
    Command::new(path)
        .spawn()
        .map_err(|e| format!("Could not run AppImage: {e}"))?;
    Ok(())
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch_linux_package(path: &Path) -> Result<(), String> {
    spawn_desktop_open(path)
}

#[cfg(all(unix, not(target_os = "macos")))]
fn launch_linux_zip(path: &Path) -> Result<(), String> {
    spawn_desktop_open(path.parent().unwrap_or(path))
}

#[cfg(all(unix, not(target_os = "macos")))]
fn spawn_desktop_open(path: &Path) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Could not open with desktop handler (xdg-open): {e}"))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_accepts_github_release_download() {
        validate_release_download_url(
            "https://github.com/Dendro-X0/Deco/releases/download/v0.8.3/Deco_0.8.3_x64_en-US.msi",
        )
        .expect("github releases/download");
    }

    #[test]
    fn validate_accepts_objects_host() {
        validate_release_download_url(
            "https://objects.githubusercontent.com/github-production-release-asset/1/2/3?token=abc",
        )
        .expect("objects host");
    }

    #[test]
    fn validate_rejects_random_https() {
        assert!(validate_release_download_url("https://evil.example/a.msi").is_err());
    }

    #[test]
    fn sanitize_accepts_typical_asset_name() {
        assert_eq!(
            sanitize_download_filename("Deco_0.8.3_x64-setup.msi").unwrap(),
            "Deco_0.8.3_x64-setup.msi"
        );
    }

    #[test]
    fn installer_kind_windows_msi_and_exe() {
        assert_eq!(
            installer_kind_for_target(Path::new("Deco_0.8.3_x64_en-US.msi"), "windows"),
            InstallerKind::WindowsMsi
        );
        assert_eq!(
            installer_kind_for_target(Path::new("Deco_0.8.3_x64-setup.exe"), "windows"),
            InstallerKind::WindowsExe
        );
    }

    #[test]
    fn installer_kind_macos_dmg_and_pkg() {
        assert_eq!(
            installer_kind_for_target(Path::new("Deco_0.8.3_aarch64.dmg"), "macos"),
            InstallerKind::MacosDmg
        );
        assert_eq!(
            installer_kind_for_target(Path::new("Deco_0.8.3_universal.pkg"), "macos"),
            InstallerKind::MacosPkg
        );
    }

    #[test]
    fn installer_kind_linux_appimage_deb_rpm() {
        assert_eq!(
            installer_kind_for_target(Path::new("Deco_0.8.3_amd64.AppImage"), "linux"),
            InstallerKind::LinuxAppImage
        );
        assert_eq!(
            installer_kind_for_target(Path::new("deco_0.8.3_amd64.deb"), "linux"),
            InstallerKind::LinuxDeb
        );
        assert_eq!(
            installer_kind_for_target(Path::new("Deco-0.8.3.x86_64.rpm"), "linux"),
            InstallerKind::LinuxRpm
        );
    }

    #[test]
    fn installer_kind_rejects_cross_os_extensions() {
        assert_eq!(
            installer_kind_for_target(Path::new("setup.msi"), "macos"),
            InstallerKind::Unsupported
        );
        assert_eq!(
            installer_kind_for_target(Path::new("app.AppImage"), "windows"),
            InstallerKind::Unsupported
        );
    }
}
