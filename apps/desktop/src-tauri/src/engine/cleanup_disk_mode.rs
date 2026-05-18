//! Delete parallelism profile for mechanical vs fast disks (v0.6.6).

use super::delete_parallel::delete_parallelism_from_scan_mode;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CleanupDiskMode {
    /// Respect scan workers with batch caps (existing v0.6.5 behavior).
    Auto,
    /// One tree at a time — best for HDDs and huge batches.
    Hdd,
    /// Always use scan performance preset caps (may parallelize).
    Standard,
}

pub fn parse_cleanup_disk_mode(raw: &str) -> CleanupDiskMode {
    match raw.trim().to_ascii_lowercase().as_str() {
        "hdd" | "sequential" => CleanupDiskMode::Hdd,
        "standard" | "ssd" | "fast" => CleanupDiskMode::Standard,
        _ => CleanupDiskMode::Auto,
    }
}

/// Effective parallel tree deletes for in-place cleanup.
pub fn delete_parallelism_for_cleanup(
    disk_mode: CleanupDiskMode,
    scan_concurrency_mode: &str,
    item_count: usize,
) -> usize {
    match disk_mode {
        CleanupDiskMode::Hdd => 1,
        CleanupDiskMode::Standard => {
            delete_parallelism_from_scan_mode(scan_concurrency_mode, item_count)
        }
        CleanupDiskMode::Auto => {
            let mode = if scan_concurrency_mode == "low" {
                "low"
            } else {
                scan_concurrency_mode
            };
            delete_parallelism_from_scan_mode(mode, item_count)
        }
    }
}

pub fn cleanup_disk_mode_label(mode: CleanupDiskMode) -> &'static str {
    match mode {
        CleanupDiskMode::Auto => "auto",
        CleanupDiskMode::Hdd => "hdd",
        CleanupDiskMode::Standard => "standard",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hdd_mode_is_always_sequential() {
        assert_eq!(
            delete_parallelism_for_cleanup(CleanupDiskMode::Hdd, "high", 10_000),
            1
        );
    }

    #[test]
    fn auto_respects_low_scan_mode() {
        assert_eq!(
            delete_parallelism_for_cleanup(CleanupDiskMode::Auto, "low", 50),
            2
        );
    }

    #[test]
    fn parse_aliases() {
        assert_eq!(parse_cleanup_disk_mode("sequential"), CleanupDiskMode::Hdd);
        assert_eq!(parse_cleanup_disk_mode("standard"), CleanupDiskMode::Standard);
    }
}
