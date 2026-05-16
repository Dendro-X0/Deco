use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct StorageVolume {
    pub mount_point: String,
    pub name: String,
    pub total_bytes: u64,
    pub available_bytes: u64,
    pub used_bytes: u64,
    /// fixed | removable | network | ramdisk | other
    pub volume_kind: String,
}

pub fn list_storage_volumes() -> Vec<StorageVolume> {
    let mut volumes = Vec::new();

    #[cfg(windows)]
    {
        for letter in b'A'..=b'Z' {
            let mount = format!("{}:\\", letter as char);
            if let Some(vol) = volume_info_windows(&mount) {
                volumes.push(vol);
            }
        }
    }

    #[cfg(unix)]
    {
        if let Some(vol) = volume_info_unix("/") {
            volumes.push(vol);
        }
        if let Some(home) = std::env::var_os("HOME").map(std::path::PathBuf::from) {
            let home_str = home.to_string_lossy().to_string();
            if home_str != "/" {
                if let Some(vol) = volume_info_unix(&home_str) {
                    volumes.push(vol);
                }
            }
        }
        for mount_root in ["/mnt", "/media"] {
            let root = std::path::Path::new(mount_root);
            if root.is_dir() {
                if let Ok(entries) = std::fs::read_dir(root) {
                    for entry in entries.flatten() {
                        let path = entry.path().to_string_lossy().to_string();
                        if let Some(vol) = volume_info_unix(&path) {
                            volumes.push(vol);
                        }
                    }
                }
            }
        }
    }

    dedupe_volumes(volumes)
}

fn dedupe_volumes(volumes: Vec<StorageVolume>) -> Vec<StorageVolume> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for v in volumes {
        let key = v.mount_point.to_lowercase();
        if seen.insert(key) {
            out.push(v);
        }
    }
    out.sort_by(|a, b| a.mount_point.cmp(&b.mount_point));
    out
}

#[cfg(windows)]
fn volume_info_windows(mount: &str) -> Option<StorageVolume> {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        GetDiskFreeSpaceExW, GetDriveTypeW, GetVolumeInformationW,
    };

    const DRIVE_REMOVABLE: u32 = 2;
    const DRIVE_FIXED: u32 = 3;
    const DRIVE_REMOTE: u32 = 4;
    const DRIVE_RAMDISK: u32 = 6;

    let wide: Vec<u16> = OsStr::new(mount).encode_wide().chain(Some(0)).collect();
    let root = PCWSTR(wide.as_ptr());

    let drive_type = unsafe { GetDriveTypeW(root) };
    let volume_kind = match drive_type {
        DRIVE_FIXED => "fixed",
        DRIVE_REMOVABLE => "removable",
        DRIVE_REMOTE => "network",
        DRIVE_RAMDISK => "ramdisk",
        _ => return None,
    };

    let mut free_avail = 0u64;
    let mut total = 0u64;
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            root,
            Some(&mut free_avail),
            Some(&mut total),
            None,
        )
    };
    if ok.is_err() || total == 0 {
        return None;
    }

    let mut label_buf = [0u16; 256];
    let label_ok = unsafe {
        GetVolumeInformationW(
            root,
            Some(&mut label_buf),
            None,
            None,
            None,
            None,
        )
    };
    let name = if label_ok.is_ok() {
        let len = label_buf.iter().position(|&c| c == 0).unwrap_or(0);
        String::from_utf16_lossy(&label_buf[..len])
    } else {
        mount.trim_end_matches('\\').to_string()
    };

    let used = total.saturating_sub(free_avail);
    Some(StorageVolume {
        mount_point: mount.to_string(),
        name: if name.is_empty() {
            mount.to_string()
        } else {
            format!("{name} ({mount})")
        },
        total_bytes: total,
        available_bytes: free_avail,
        used_bytes: used,
        volume_kind: volume_kind.to_string(),
    })
}

#[cfg(unix)]
fn volume_info_unix(mount: &str) -> Option<StorageVolume> {
    use std::ffi::CString;
    use std::path::Path;

    if !Path::new(mount).exists() {
        return None;
    }
    let c_path = CString::new(mount).ok()?;
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) } != 0 {
        return None;
    }
    let block_size = stat.f_frsize as u64;
    let total = stat.f_blocks as u64 * block_size;
    let available = stat.f_bavail as u64 * block_size;
    if total == 0 {
        return None;
    }
    let used = total.saturating_sub(available);
    Some(StorageVolume {
        mount_point: mount.to_string(),
        name: mount.to_string(),
        total_bytes: total,
        available_bytes: available,
        used_bytes: used,
        volume_kind: "fixed".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_at_least_one_volume() {
        let volumes = list_storage_volumes();
        assert!(!volumes.is_empty());
        assert!(volumes[0].total_bytes > 0);
    }
}
