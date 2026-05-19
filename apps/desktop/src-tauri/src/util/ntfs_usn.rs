//! Experimental NTFS USN journal probe (v0.8.5).
//!
//! When enabled in Settings, each scan records whether NTFS + an active USN journal
//! is visible on involved drive-letter volumes. **Discovery still uses the legacy walk**;
//! this module is the foundation for a future USN-assisted fast path.

/// `true` when Settings → experimental NTFS USN inventory is enabled.
/// `roots` are effective scan roots (expanded folders / mount paths).
pub fn usn_inventory_preflight_warnings(enabled: bool, roots: &[String]) -> Vec<String> {
    if !enabled {
        return vec![];
    }
    #[cfg(not(windows))]
    {
        let _ = roots;
        vec!["Experimental NTFS USN journal probe: Windows NTFS volumes only — option has no effect on this platform.".to_string()]
    }
    #[cfg(windows)]
    {
        win::go(roots)
    }
}

#[cfg(windows)]
mod win {
    use std::collections::BTreeSet;
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use ::windows::core::PCWSTR;
    use ::windows::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use ::windows::Win32::Storage::FileSystem::{
        CreateFileW, GetVolumeInformationW, FILE_FLAGS_AND_ATTRIBUTES, FILE_SHARE_READ,
        FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use ::windows::Win32::System::IO::DeviceIoControl;

    /// `FSCTL_QUERY_USN_JOURNAL` — winioctl.h
    const FSCTL_QUERY_USN_JOURNAL: u32 = 0x0009_00f4;

    #[repr(C)]
    #[derive(Clone, Copy, Default)]
    struct UsnJournalData {
        journal_id: u64,
        first_usn: i64,
        next_usn: i64,
        lowest_valid_usn: i64,
        max_usn: i64,
        maximum_size: u64,
        allocation_delta: u64,
    }

    pub fn go(roots: &[String]) -> Vec<String> {
        let mounts = unique_drive_mounts(roots);
        if mounts.is_empty() {
            return vec!["Experimental USN: no drive-letter paths in scan roots — journal probe skipped.".to_string()];
        }
        mounts
            .into_iter()
            .map(|m| probe_volume_line(&m))
            .collect()
    }

    fn unique_drive_mounts(roots: &[String]) -> Vec<String> {
        let mut set = BTreeSet::new();
        for r in roots {
            let r = r.trim();
            let r = if let Some(rest) = r.strip_prefix("\\\\?\\") {
                rest
            } else {
                r
            };
            let bytes = r.as_bytes();
            if bytes.len() >= 2 && bytes[1] == b':' {
                let ch = char::from(bytes[0].to_ascii_uppercase());
                if ch.is_ascii_alphabetic() {
                    set.insert(format!("{}:\\", ch));
                }
            }
        }
        set.into_iter().collect()
    }

    fn probe_volume_line(mount: &str) -> String {
        let display = mount.trim_end_matches(['\\', '/']).to_string();
        let root = Path::new(mount);
        if !root.exists() {
            return format!("Experimental USN ({display}): path not found — skipped.");
        }

        let fs_name = match read_filesystem_name(mount) {
            Ok(s) => s,
            Err(e) => {
                return format!("Experimental USN ({display}): could not read volume label ({e}).");
            }
        };
        if !fs_name.eq_ignore_ascii_case("NTFS") {
            return format!(
                "Experimental USN ({display}): filesystem is \"{fs_name}\" (not NTFS) — skipped."
            );
        }

        let vol_path = volume_device_path(mount);
        let wide: Vec<u16> = OsStr::new(&vol_path).encode_wide().chain(Some(0)).collect();

        let handle = unsafe {
            CreateFileW(
                PCWSTR(wide.as_ptr()),
                0x8000_0000u32, // GENERIC_READ
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                None,
                OPEN_EXISTING,
                FILE_FLAGS_AND_ATTRIBUTES(0),
                None,
            )
        };

        let handle = match handle {
            Ok(h) if h != INVALID_HANDLE_VALUE => h,
            Ok(_) | Err(_) => {
                return format!(
                    "Experimental USN ({display}): NTFS volume handle could not be opened (admin or policy may be required) — using legacy walk."
                );
            }
        };

        let mut data = UsnJournalData::default();
        let mut returned: u32 = 0;
        let ioctl_ok: windows::core::Result<()> = unsafe {
            DeviceIoControl(
                handle,
                FSCTL_QUERY_USN_JOURNAL,
                None,
                0,
                Some(&mut data as *mut _ as *mut _),
                std::mem::size_of::<UsnJournalData>() as u32,
                Some(&mut returned),
                None,
            )
        };
        let _ = unsafe { CloseHandle(handle) };

        if ioctl_ok.is_err() || returned < std::mem::size_of::<UsnJournalData>() as u32 {
            return format!(
                "Experimental USN ({display}): NTFS but USN journal query failed — using legacy walk."
            );
        }

        format!(
            "Experimental USN ({display}): NTFS journal active (journal_id={:#x}, next_usn={}); discover still uses full directory walk.",
            data.journal_id, data.next_usn
        )
    }

    fn volume_device_path(mount: &str) -> String {
        let t = mount.trim().trim_end_matches(['\\', '/']);
        let bytes = t.as_bytes();
        if bytes.len() >= 2 && bytes[1] == b':' {
            let letter = char::from(bytes[0].to_ascii_uppercase());
            return format!(r"\\.\{}:", letter);
        }
        t.to_string()
    }

    fn read_filesystem_name(mount: &str) -> Result<String, String> {
        let wide: Vec<u16> = OsStr::new(mount).encode_wide().chain(Some(0)).collect();
        let mut fs_buf = [0u16; 32];
        unsafe {
            GetVolumeInformationW(
                PCWSTR(wide.as_ptr()),
                None,
                None,
                None,
                None,
                Some(&mut fs_buf),
            )
            .map_err(|e| format!("{e}"))?;
        }
        let len = fs_buf.iter().position(|&c| c == 0).unwrap_or(0);
        Ok(String::from_utf16_lossy(&fs_buf[..len]))
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn unique_mounts_from_mixed_paths() {
            let roots = vec![
                r"D:\a\b".to_string(),
                r"d:\x".to_string(),
                r"\\?\D:\z".to_string(),
            ];
            let m = unique_drive_mounts(&roots);
            assert_eq!(m, vec![r"D:\".to_string()]);
        }

        #[test]
        fn probe_smoke_c_drive_when_present() {
            if !Path::new(r"C:\").exists() {
                return;
            }
            let lines = super::super::usn_inventory_preflight_warnings(true, &[r"C:\Windows".to_string()]);
            assert_eq!(lines.len(), 1);
            let line = &lines[0];
            assert!(line.starts_with("Experimental USN (C:)"), "{line}");
            assert!(
                line.contains("NTFS journal active")
                    || line.contains("not NTFS")
                    || line.contains("could not be opened")
                    || line.contains("journal query failed")
                    || line.contains("could not read volume"),
                "{line}"
            );
        }
    }
}

#[cfg(all(test, not(windows)))]
mod non_windows_tests {
    use super::*;

    #[test]
    fn enabled_off_windows_emits_single_notice() {
        let w = usn_inventory_preflight_warnings(true, &["/".to_string()]);
        assert_eq!(w.len(), 1);
        assert!(w[0].contains("Windows"));
    }

    #[test]
    fn disabled_is_empty() {
        assert!(usn_inventory_preflight_warnings(false, &[]).is_empty());
    }
}
