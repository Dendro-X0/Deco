//! Headless scan pipeline timing for maintainer benchmarks (v0.6.2).

use super::classifier::classify_targets;
use super::disk_cleanup_config::merge_disk_cleanup_layers;
use super::path_policy::PathPolicy;
use super::scan_concurrency::{scan_worker_count, size_concurrency_plan};
use super::scanner::discover_targets;
use super::sizer::size_candidates_parallel;
use super::types::ScanRequest;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

pub const CLASSIFY_PIPELINE_CHUNK: usize = 64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanBenchResult {
    pub discover_ms: u64,
    pub classify_ms: u64,
    pub size_ms: u64,
    pub total_ms: u64,
    pub candidate_count: usize,
    pub scanned_dirs: u64,
    pub include_size: bool,
    pub concurrency_mode: String,
    pub fixture_projects: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchBaseline {
    pub schema_version: u32,
    pub fixture_projects: usize,
    pub include_size: bool,
    pub limits: BenchLimits,
    #[serde(default = "default_regression_ratio")]
    pub regression_ratio_max: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchLimits {
    pub discover_ms_max: u64,
    pub classify_ms_max: u64,
    pub size_ms_max: u64,
    pub min_candidates: usize,
}

fn default_regression_ratio() -> f64 {
    1.35
}

#[derive(Debug)]
pub struct BenchCompareOutcome {
    pub passed: bool,
    pub messages: Vec<String>,
}

/// Fixture parent that avoids `AppData` in the path (Windows path policy prunes `/appdata/`).
pub fn default_fixture_parent() -> PathBuf {
    if let Ok(custom) = std::env::var("DECO_BENCH_ROOT") {
        return PathBuf::from(custom);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../target/deco-bench-runs")
}

/// Create `project_count` synthetic Rust `target/debug/deps` trees under `root`.
pub fn generate_synthetic_fixture(root: &Path, project_count: usize) -> Result<(), String> {
    fs::create_dir_all(root).map_err(|e| format!("create fixture root: {e}"))?;
    for i in 0..project_count {
        let proj = root.join(format!("bench-proj-{i:03}"));
        fs::create_dir_all(&proj).map_err(|e| format!("mkdir project: {e}"))?;
        fs::write(
            proj.join("Cargo.toml"),
            format!(
                "[package]\nname = \"bench-proj-{i}\"\nversion = \"0.1.0\"\nedition = \"2021\"\n"
            ),
        )
        .map_err(|e| format!("write Cargo.toml: {e}"))?;
        fs::create_dir_all(proj.join("target").join("debug").join("deps"))
            .map_err(|e| format!("mkdir target: {e}"))?;
        fs::write(proj.join("target").join("debug").join("deps").join("stub"), b"x")
            .map_err(|e| format!("write stub: {e}"))?;
    }
    Ok(())
}

pub fn default_bench_request(include_size: bool) -> ScanRequest {
    ScanRequest {
        roots: vec![],
        max_depth: 8,
        profile: "balanced".to_string(),
        include_size,
        stale_days: 45,
        show_blocked: true,
        check_go_cache: false,
        include_python_artifacts: true,
        include_python_venv: false,
        include_jvm_artifacts: true,
        check_jvm_global_cache: false,
        include_dotnet_artifacts: true,
        check_ide_global_cache: false,
        check_npm_cache: false,
        check_pnpm_store: false,
        check_yarn_cache: false,
        check_pip_cache: false,
        check_uv_cache: false,
        check_conda_pkgs_cache: false,
        check_cargo_registry: false,
        check_bun_cache: false,
        check_nuget_cache: false,
        check_composer_cache: false,
        exclude_abs_path_contains: vec![],
        extra_protected_path_contains: vec![],
        allow_path_contains: vec![],
        scan_mode: "full".to_string(),
    }
}

pub fn run_scan_pipeline_bench(
    roots: &[String],
    req: &ScanRequest,
    concurrency_mode: &str,
    fixture_projects: usize,
) -> Result<ScanBenchResult, String> {
    let disk = merge_disk_cleanup_layers(roots)?;
    let merged_excludes: Vec<String> = req
        .exclude_abs_path_contains
        .iter()
        .chain(disk.exclude_abs_path_contains.iter())
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let merged_extra_protected: Vec<String> = req
        .extra_protected_path_contains
        .iter()
        .chain(disk.extra_protected_path_contains.iter())
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let merged_allow: Vec<String> = req
        .allow_path_contains
        .iter()
        .chain(disk.allow_path_contains.iter())
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();
    let policy = PathPolicy::new(merged_extra_protected, merged_allow);

    let discover_start = Instant::now();
    let discovery = discover_targets(
        roots,
        req.max_depth,
        &req.profile,
        &merged_excludes,
        &policy,
        req.into(),
        req.check_go_cache,
        &disk.extra_names,
        false,
        scan_worker_count(concurrency_mode),
        None,
        None,
    );
    let discover_ms = discover_start.elapsed().as_millis() as u64;

    let size_plan = size_concurrency_plan(concurrency_mode);
    let targets = discovery.targets;
    let mut candidates = Vec::with_capacity(targets.len());
    let mut classify_ms = 0u64;
    let mut size_ms = 0u64;

    for chunk in targets.chunks(CLASSIFY_PIPELINE_CHUNK) {
        let classify_start = Instant::now();
        let classified = classify_targets(
            chunk.to_vec(),
            roots,
            req.stale_days,
            &policy,
            crate::engine::classifier::DEFAULT_CLASSIFY_PARALLEL_THRESHOLD,
        );
        classify_ms = classify_ms.saturating_add(classify_start.elapsed().as_millis() as u64);
        candidates.extend(classified);

        if req.include_size {
            let size_start = Instant::now();
            let batch_start = candidates.len().saturating_sub(chunk.len());
            let _ = size_candidates_parallel(
                &mut candidates[batch_start..],
                &size_plan,
                || false,
                |_, _| {},
            );
            size_ms = size_ms.saturating_add(size_start.elapsed().as_millis() as u64);
        }
    }

    let total_ms = discover_ms.saturating_add(classify_ms).saturating_add(size_ms);

    Ok(ScanBenchResult {
        discover_ms,
        classify_ms,
        size_ms,
        total_ms,
        candidate_count: candidates.len(),
        scanned_dirs: discovery.scanned_dirs,
        include_size: req.include_size,
        concurrency_mode: concurrency_mode.to_string(),
        fixture_projects,
    })
}

pub fn compare_to_baseline(result: &ScanBenchResult, baseline: &BenchBaseline) -> BenchCompareOutcome {
    let mut messages = Vec::new();
    let mut passed = true;

    if result.candidate_count < baseline.limits.min_candidates {
        passed = false;
        messages.push(format!(
            "candidate_count {} < min {}",
            result.candidate_count, baseline.limits.min_candidates
        ));
    }
    if result.discover_ms > baseline.limits.discover_ms_max {
        passed = false;
        messages.push(format!(
            "discover_ms {} > max {}",
            result.discover_ms, baseline.limits.discover_ms_max
        ));
    }
    if result.classify_ms > baseline.limits.classify_ms_max {
        passed = false;
        messages.push(format!(
            "classify_ms {} > max {}",
            result.classify_ms, baseline.limits.classify_ms_max
        ));
    }
    if result.size_ms > baseline.limits.size_ms_max {
        passed = false;
        messages.push(format!(
            "size_ms {} > max {}",
            result.size_ms, baseline.limits.size_ms_max
        ));
    }
    let total_cap = ((baseline.limits.discover_ms_max
        + baseline.limits.classify_ms_max
        + baseline.limits.size_ms_max) as f64
        * baseline.regression_ratio_max) as u64;
    if result.total_ms > total_cap {
        passed = false;
        messages.push(format!(
            "total_ms {} > regression cap {} (ratio {})",
            result.total_ms, total_cap, baseline.regression_ratio_max
        ));
    }

    if passed {
        messages.push("all benchmark limits satisfied".to_string());
    }

    BenchCompareOutcome { passed, messages }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn synthetic_fixture_yields_rust_targets() {
        let root = default_fixture_parent().join(format!("test-{}", uuid::Uuid::new_v4()));
        generate_synthetic_fixture(&root, 12).expect("fixture");
        assert!(root.join("bench-proj-000").join("Cargo.toml").is_file());
        let root_str = root.to_string_lossy().to_string();
        let mut req = default_bench_request(false);
        req.roots = vec![root_str.clone()];
        let result = run_scan_pipeline_bench(&[root_str], &req, "auto", 12).expect("bench");
        assert!(
            result.candidate_count >= 10,
            "expected >= 10 candidates, got {} (scanned_dirs={})",
            result.candidate_count, result.scanned_dirs
        );
        let _ = fs::remove_dir_all(&root);
    }
}
