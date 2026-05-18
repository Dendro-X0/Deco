use super::scan_concurrency::SizeConcurrencyPlan;
use super::size_estimate::{self, kind_uses_fast_estimate};
use super::types::{CleanupCandidate, Kind};
use rayon::prelude::*;
use std::path::Path;
use std::time::{Duration, Instant};
use walkdir::WalkDir;

/// Per-target size walk timeout (matches CLI `SIZE_TIMEOUT_MS`).
pub const SIZE_WALK_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug, Clone, Copy, Default)]
pub struct SizeWalkConfig {
    /// When true, `node_modules` / `target` / similar trees use sampled sizing first.
    pub fast_dependency_estimate: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DirSizeOutcome {
    /// Walk finished without timeout; `0` means an empty directory.
    Measured(u64),
    /// Sampled or partial walk — still shown in UI with an estimate marker.
    Estimated(u64, Vec<String>),
    /// Walk was interrupted, path missing, or otherwise incomplete — do not treat as zero bytes.
    NotCalculated(Vec<String>),
}

impl DirSizeOutcome {
    pub fn bytes(&self) -> Option<u64> {
        match self {
            DirSizeOutcome::Measured(b) | DirSizeOutcome::Estimated(b, _) => Some(*b),
            DirSizeOutcome::NotCalculated(_) => None,
        }
    }

    pub fn is_estimate(&self) -> bool {
        matches!(self, DirSizeOutcome::Estimated(_, _))
    }

    pub fn into_warnings(self) -> Vec<String> {
        match self {
            DirSizeOutcome::Estimated(_, w) | DirSizeOutcome::NotCalculated(w) => w,
            DirSizeOutcome::Measured(_) => vec![],
        }
    }
}

/// Directory size using a non-following walk (avoids symlink cycles).
pub fn dir_size_bytes(path: &Path) -> DirSizeOutcome {
    dir_size_bytes_for_kind(path, Kind::UnknownArtifact, SizeWalkConfig::default())
}

pub fn dir_size_bytes_for_kind(path: &Path, kind: Kind, config: SizeWalkConfig) -> DirSizeOutcome {
    if config.fast_dependency_estimate && kind_uses_fast_estimate(kind) {
        return size_estimate::estimate_dependency_tree_size(path);
    }
    dir_size_bytes_full(path)
}

fn dir_size_bytes_full(path: &Path) -> DirSizeOutcome {
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
    config: SizeWalkConfig,
    mut should_cancel: impl FnMut() -> bool,
    mut on_batch_sized: impl FnMut(usize, usize),
) -> (Vec<String>, bool) {
    let mut warnings = Vec::new();
    let total = candidates.len();
    if total == 0 {
        return (warnings, false);
    }
    let stride = plan.max_parallel_sizers().max(1);

    for batch_start in (0..total).step_by(stride) {
        if should_cancel() {
            return (warnings, true);
        }
        let batch_end = (batch_start + stride).min(total);
        let sized: Vec<(usize, DirSizeOutcome)> = candidates[batch_start..batch_end]
            .par_iter()
            .enumerate()
            .map(|(offset, candidate)| {
                let outcome = dir_size_bytes_for_kind(
                    Path::new(&candidate.abs_path),
                    candidate.kind,
                    config,
                );
                (batch_start + offset, outcome)
            })
            .collect();

        for (idx, outcome) in sized {
            let is_estimate = outcome.is_estimate();
            let bytes = outcome.bytes();
            let mut size_warnings = outcome.into_warnings();
            warnings.append(&mut size_warnings);
            if let Some(bytes) = bytes {
                candidates[idx].size_bytes = Some(bytes);
                if is_estimate
                    && !candidates[idx]
                        .reason_codes
                        .iter()
                        .any(|c| c == "size_estimated")
                {
                    candidates[idx]
                        .reason_codes
                        .push("size_estimated".to_string());
                }
            } else {
                candidates[idx].size_bytes = None;
            }
        }
        on_batch_sized(batch_end, total);
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
        assert!(matches!(
            dir_size_bytes(&missing),
            DirSizeOutcome::NotCalculated(_)
        ));
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

    #[test]
    fn fast_estimate_uses_sampling_for_node_modules() {
        let base = std::env::temp_dir().join(format!("deco-sizer-nm-{}", uuid::Uuid::new_v4()));
        create_dir_all(&base).expect("mkdir");
        for i in 0..4 {
            let pkg = base.join(format!("pkg-{i}"));
            create_dir_all(&pkg).expect("pkg");
            write(pkg.join("index.js"), vec![0u8; 1024]).expect("w");
        }
        let cfg = SizeWalkConfig {
            fast_dependency_estimate: true,
        };
        match dir_size_bytes_for_kind(&base, Kind::NodeModules, cfg) {
            DirSizeOutcome::Estimated(_, _) | DirSizeOutcome::Measured(_) => {}
            other => panic!("expected size, got {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&base);
    }
}
