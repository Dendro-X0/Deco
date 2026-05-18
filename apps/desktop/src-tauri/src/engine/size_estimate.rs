//! Fast sampled sizing for heavy dependency trees (v0.6.7).

use super::sizer::DirSizeOutcome;
use super::types::Kind;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

/// Wall-clock budget for the whole estimate (per candidate).
pub const ESTIMATE_WALL_MS: u64 = 12_000;
/// Top-level packages / folders to sample.
pub const PACKAGE_SAMPLE_COUNT: usize = 8;
/// Per sampled child folder before moving on.
pub const PER_CHILD_BUDGET_MS: u64 = 4_000;
/// Trees with at most this many files get an exact walk instead of sampling.
pub const SMALL_TREE_FILE_CAP: u64 = 600;

pub fn kind_uses_fast_estimate(kind: Kind) -> bool {
    matches!(
        kind,
        Kind::NodeModules | Kind::RustArtifact | Kind::BuildArtifact | Kind::PythonVenv
    )
}

/// Sample top-level children and scale by count — for `node_modules`, `target`, etc.
pub fn estimate_dependency_tree_size(path: &Path) -> DirSizeOutcome {
    let mut warnings = Vec::new();
    if !path.exists() {
        warnings.push(format!("Path not found for sizing: {}", path.display()));
        return DirSizeOutcome::NotCalculated(warnings);
    }

    let top_level = match list_top_level_entries(path) {
        Ok(v) => v,
        Err(e) => {
            warnings.push(e);
            return DirSizeOutcome::NotCalculated(warnings);
        }
    };

    if top_level.is_empty() {
        return DirSizeOutcome::Measured(0);
    }

    if let Some(outcome) = try_small_tree_exact(path, &mut warnings) {
        return outcome;
    }

    let sample_n = PACKAGE_SAMPLE_COUNT.min(top_level.len());
    let wall = Duration::from_millis(ESTIMATE_WALL_MS);
    let per_child = Duration::from_millis(PER_CHILD_BUDGET_MS);
    let started = Instant::now();
    let mut sampled_bytes = 0u64;
    let mut samples = 0u32;

    for i in 0..sample_n {
        if started.elapsed() >= wall {
            break;
        }
        let idx = sample_index(i, sample_n, top_level.len());
        let child = &top_level[idx];
        match dir_size_bytes_capped(
            child,
            per_child.min(wall.saturating_sub(started.elapsed())),
            true,
        ) {
            DirSizeOutcome::Measured(b) | DirSizeOutcome::Estimated(b, _) => {
                sampled_bytes = sampled_bytes.saturating_add(b);
                samples += 1;
            }
            DirSizeOutcome::NotCalculated(mut w) => warnings.append(&mut w),
        }
    }

    if samples == 0 {
        warnings.push("Sampled estimate failed — using capped walk".to_string());
        return dir_size_bytes_capped(
            path,
            Duration::from_millis(ESTIMATE_WALL_MS),
            true,
        );
    }

    let avg = sampled_bytes / u64::from(samples);
    let estimate = avg.saturating_mul(top_level.len() as u64);
    warnings.push(format!(
        "Size estimated from {samples} of {} top-level folder(s) under {}",
        top_level.len(),
        path.display()
    ));
    DirSizeOutcome::Estimated(estimate, warnings)
}

fn sample_index(i: usize, sample_n: usize, total: usize) -> usize {
    if sample_n <= 1 || total <= 1 {
        return 0;
    }
    i * (total - 1) / (sample_n - 1)
}

fn list_top_level_entries(path: &Path) -> Result<Vec<PathBuf>, String> {
    let read = fs::read_dir(path).map_err(|e| format!("read_dir {}: {e}", path.display()))?;
    let mut entries: Vec<PathBuf> = read
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect();
    entries.sort();
    Ok(entries)
}

/// Quick shallow file count; if small enough, run an exact capped walk.
fn try_small_tree_exact(path: &Path, warnings: &mut Vec<String>) -> Option<DirSizeOutcome> {
    let count = shallow_file_count(path, 4, SMALL_TREE_FILE_CAP.saturating_add(1));
    if count > SMALL_TREE_FILE_CAP {
        return None;
    }
    let outcome = dir_size_bytes_capped(path, Duration::from_millis(ESTIMATE_WALL_MS), false);
    if matches!(outcome, DirSizeOutcome::NotCalculated(_)) {
        warnings.push("Small-tree exact walk failed".to_string());
    }
    Some(outcome)
}

fn shallow_file_count(path: &Path, max_depth: u32, stop_after: u64) -> u64 {
    let mut count = 0u64;
    shallow_file_count_inner(path, 0, max_depth, &mut count, stop_after);
    count
}

fn shallow_file_count_inner(
    path: &Path,
    depth: u32,
    max_depth: u32,
    count: &mut u64,
    stop_after: u64,
) {
    if *count > stop_after {
        return;
    }
    let Ok(read) = fs::read_dir(path) else {
        return;
    };
    for entry in read.flatten() {
        if *count > stop_after {
            return;
        }
        let p = entry.path();
        let ft = entry.file_type();
        let Ok(ft) = ft else { continue };
        if ft.is_file() {
            *count += 1;
        } else if ft.is_dir() && depth < max_depth {
            shallow_file_count_inner(&p, depth + 1, max_depth, count, stop_after);
        }
    }
}

/// Walk with a budget; on timeout returns [`DirSizeOutcome::Estimated`] partial bytes when allowed.
pub fn dir_size_bytes_capped(
    path: &Path,
    budget: Duration,
    partial_on_timeout: bool,
) -> DirSizeOutcome {
    use walkdir::WalkDir;

    let mut warnings = Vec::new();
    if !path.exists() {
        warnings.push(format!("Path not found for sizing: {}", path.display()));
        return DirSizeOutcome::NotCalculated(warnings);
    }
    let mut size = 0u64;
    let started = Instant::now();
    let mut timed_out = false;
    for item in WalkDir::new(path).follow_links(false).into_iter() {
        if started.elapsed() > budget {
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
        if partial_on_timeout && size > 0 {
            warnings.push(format!(
                "Size walk timed out after {}ms — using partial count ({})",
                budget.as_millis(),
                path.display()
            ));
            DirSizeOutcome::Estimated(size, warnings)
        } else {
            warnings.push(format!(
                "Size walk timed out after {}ms: {}",
                budget.as_millis(),
                path.display()
            ));
            DirSizeOutcome::NotCalculated(warnings)
        }
    } else if warnings.is_empty() {
        DirSizeOutcome::Measured(size)
    } else {
        DirSizeOutcome::Measured(size)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, write};

    #[test]
    fn estimate_scales_with_top_level_packages() {
        let root = std::env::temp_dir().join(format!("deco-est-{}", uuid::Uuid::new_v4()));
        create_dir_all(&root).expect("root");
        for p in 0..12 {
            let pkg = root.join(format!("@scope-pkg-{p}"));
            create_dir_all(&pkg).expect("pkg");
            write(pkg.join("index.js"), vec![0u8; 2048]).expect("file");
        }
        let outcome = estimate_dependency_tree_size(&root);
        let bytes = outcome.bytes().expect("size");
        assert!(
            bytes >= 12 * 2048,
            "size should reflect all packages, got {bytes}"
        );
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn estimate_prefers_sampling_when_many_top_level_entries() {
        let root = std::env::temp_dir().join(format!("deco-est2-{}", uuid::Uuid::new_v4()));
        create_dir_all(&root).expect("root");
        for p in 0..24 {
            let pkg = root.join(format!("pkg-{p}"));
            let nested = pkg.join("lib");
            create_dir_all(&nested).expect("pkg");
            for f in 0..30 {
                write(nested.join(format!("f{f}.bin")), vec![0u8; 128]).expect("file");
            }
        }
        match estimate_dependency_tree_size(&root) {
            DirSizeOutcome::Estimated(bytes, warnings) => {
                assert!(bytes >= 24 * 30 * 128);
                assert!(warnings.iter().any(|w| w.contains("estimated")));
            }
            other => panic!("expected Estimated for many packages, got {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&root);
    }

    #[test]
    fn capped_walk_honors_partial_on_timeout_flag() {
        let root = std::env::temp_dir().join(format!("deco-cap-{}", uuid::Uuid::new_v4()));
        create_dir_all(&root).expect("root");
        write(root.join("a.txt"), vec![0u8; 100]).expect("w");
        match dir_size_bytes_capped(&root, Duration::from_secs(30), false) {
            DirSizeOutcome::Measured(100) => {}
            other => panic!("expected Measured(100), got {other:?}"),
        }
        let _ = std::fs::remove_dir_all(&root);
    }
}
