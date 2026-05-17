use super::scan_concurrency::SizeConcurrencyPlan;
use super::types::CleanupCandidate;
use rayon::prelude::*;
use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// Per-target size walk timeout (matches CLI `SIZE_TIMEOUT_MS`).
pub const SIZE_WALK_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DirSizeOutcome {
    /// Walk finished without timeout; `0` means an empty directory.
    Measured(u64),
    /// Walk was interrupted, path missing, or otherwise incomplete — do not treat as zero bytes.
    NotCalculated(Vec<String>),
}

/// Directory size using a non-following walk (avoids symlink cycles).
pub fn dir_size_bytes(path: &Path) -> DirSizeOutcome {
    let mut warnings = Vec::new();
    if !path.exists() {
        warnings.push(format!("Path not found for sizing: {}", path.display()));
        return DirSizeOutcome::NotCalculated(warnings);
    }
    let mut size = 0u64;
    let started = Instant::now();
    let mut timed_out = false;
    for item in WalkDir::new(path).follow_links(false).into_iter() {
        if started.elapsed() > SIZE_WALK_TIMEOUT {
            warnings.push(format!(
                "Size walk timed out after {}s: {}",
                SIZE_WALK_TIMEOUT.as_secs(),
                path.display()
            ));
            timed_out = true;
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
    if timed_out {
        DirSizeOutcome::NotCalculated(warnings)
    } else {
        DirSizeOutcome::Measured(size)
    }
}

/// Parallel directory sizing for a candidate slice (shared by scan pipeline and benchmarks).
pub fn size_candidates_parallel(
    candidates: &mut [CleanupCandidate],
    plan: &SizeConcurrencyPlan,
    mut should_cancel: impl FnMut() -> bool,
) -> (Vec<String>, bool) {
    let mut warnings = Vec::new();
    let total = candidates.len();
    if total == 0 {
        return (warnings, false);
    }
    let stride = plan.max_parallel_sizers().max(1);

    for batch_start in (0.. total).step_by(stride) {
        if should_cancel() {
            return (warnings, true);
        }
        let batch_end = (batch_start + stride).min(total);
        let sized: Vec<(usize, Option<u64>, Vec<String>)> = candidates[batch_start..batch_end]
            .par_iter()
            .enumerate()
            .map(|(offset, candidate)| {
                let outcome = dir_size_bytes(Path::new(&candidate.abs_path));
                let (size, size_warnings) = match outcome {
                    DirSizeOutcome::Measured(bytes) => (Some(bytes), vec![]),
                    DirSizeOutcome::NotCalculated(w) => (None, w),
                };
                (batch_start + offset, size, size_warnings)
            })
            .collect();

        for (idx, size, mut size_warnings) in sized {
            warnings.append(&mut size_warnings);
            candidates[idx].size_bytes = size;
        }
    }
    (warnings, false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, write};
    use std::path::PathBuf;

    #[test]
    fn measures_empty_directory_as_zero() {
        let base = std::env::temp_dir().join(format!("deco-sizer-empty-{}", uuid::Uuid::new_v4()));
        create_dir_all(&base).expect("mkdir");
        match dir_size_bytes(&base) {
            DirSizeOutcome::Measured(0) => {}
            other => panic!("expected Measured(0), got {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn missing_path_is_not_calculated() {
        let missing = PathBuf::from(std::env::temp_dir()).join(format!(
            "deco-sizer-missing-{}",
            uuid::Uuid::new_v4()
        ));
        assert!(matches!(dir_size_bytes(&missing), DirSizeOutcome::NotCalculated(_)));
    }

    #[test]
    fn sums_file_bytes_when_present() {
        let base = std::env::temp_dir().join(format!("deco-sizer-file-{}", uuid::Uuid::new_v4()));
        create_dir_all(&base).expect("mkdir");
        write(base.join("a.txt"), "hello").expect("write");
        match dir_size_bytes(&base) {
            DirSizeOutcome::Measured(n) => assert_eq!(n, 5),
            other => panic!("expected Measured(5), got {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&base);
    }
}
