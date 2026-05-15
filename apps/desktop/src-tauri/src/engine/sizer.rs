use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// Per-target size walk timeout (matches CLI `SIZE_TIMEOUT_MS`).
pub const SIZE_WALK_TIMEOUT: Duration = Duration::from_secs(30);

/// Directory size using a non-following walk (avoids symlink cycles).
/// Returns `(bytes, warnings)` for permission / IO errors during traversal.
pub fn dir_size_bytes(path: &Path) -> (u64, Vec<String>) {
    let mut warnings = Vec::new();
    let mut size = 0u64;
    if !path.exists() {
        return (0, warnings);
    }
    let started = Instant::now();
    for item in WalkDir::new(path).follow_links(false).into_iter() {
        if started.elapsed() > SIZE_WALK_TIMEOUT {
            warnings.push(format!(
                "Size walk timed out after {}s: {}",
                SIZE_WALK_TIMEOUT.as_secs(),
                path.display()
            ));
            break;
        }
        match item {
            Ok(e) => {
                if e.file_type().is_file() {
                    if let Ok(meta) = e.metadata() {
                        size = size.saturating_add(meta.len());
                    }
                }
            }
            Err(err) => warnings.push(format!(
                "Size walk under {}: {}",
                err.path()
                    .map(|p| p.display().to_string())
                    .unwrap_or_else(|| "?".into()),
                err
            )),
        }
    }
    (size, warnings)
}
