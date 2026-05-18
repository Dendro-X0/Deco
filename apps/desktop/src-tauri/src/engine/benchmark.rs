//! Headless scan pipeline timing for maintainer benchmarks (v0.6.2+).

use super::classifier::classify_targets;
use super::disk_cleanup_config::merge_disk_cleanup_layers;
use super::inventory::{
    inventory_fingerprint, split_targets_with_inventory, upsert_candidates, ScanMode,
};
use super::path_policy::PathPolicy;
use super::scan_concurrency::{scan_worker_count, size_concurrency_plan};
use super::scanner::discover_targets;
use super::sizer::{size_candidates_parallel, SizeWalkConfig};
use super::types::ScanRequest;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;

pub const CLASSIFY_PIPELINE_CHUNK: usize = 64;
/// Default `node_modules` file count per synthetic project for quick-update benches.
pub const QUICK_UPDATE_FILES_PER_NODE_MODULES: usize = 30;

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
    #[serde(default)]
    pub inventory_reused: usize,
    #[serde(default)]
    pub scan_mode: String,
}

impl ScanBenchResult {
    pub fn pipeline_ms(&self) -> u64 {
        self.classify_ms.saturating_add(self.size_ms)
    }
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickUpdateBenchResult {
    pub full: ScanBenchResult,
    pub quick: ScanBenchResult,
    /// `(full.pipeline_ms - quick.pipeline_ms) / full.pipeline_ms`
    pub pipeline_speedup_ratio: f64,
    /// `(full.total_ms - quick.total_ms) / full.total_ms`
    pub total_speedup_ratio: f64,
    pub inventory_reused: usize,
    pub inventory_reuse_ratio: f64,
    pub fixture_projects: usize,
    pub files_per_node_modules: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickUpdateBenchBaseline {
    pub schema_version: u32,
    pub fixture_projects: usize,
    pub files_per_node_modules: usize,
    pub include_size: bool,
    /// Minimum improvement on classify+size phases (inventory win).
    pub min_pipeline_speedup_ratio: f64,
    pub min_inventory_reuse_ratio: f64,
    #[serde(default)]
    pub limits: Option<QuickUpdateBenchLimits>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QuickUpdateBenchLimits {
    pub full_total_ms_max: u64,
    pub quick_total_ms_max: u64,
    pub full_pipeline_ms_max: u64,
    pub quick_pipeline_ms_max: u64,
}

fn default_regression_ratio() -> f64 {
    1.35
}

#[derive(Debug)]
pub struct BenchCompareOutcome {
    pub passed: bool,
    pub messages: Vec<String>,
}

pub struct BenchInventoryOpts<'a> {
    pub conn: &'a Connection,
    pub fingerprint: &'a str,
    pub mode: ScanMode,
    pub upsert_after: bool,
}

/// Fixture parent that avoids `AppData` in the path (Windows path policy prunes `/appdata/`).
pub fn default_fixture_parent() -> PathBuf {
    if let Ok(custom) = std::env::var("DECO_BENCH_ROOT") {
        return PathBuf::from(custom);
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../target/deco-bench-runs")
}

pub fn open_bench_db() -> Result<Connection, String> {
    let conn = Connection::open_in_memory().map_err(|e| format!("open bench db: {e}"))?;
    conn.execute_batch(include_str!("../db/schema.sql"))
        .map_err(|e| format!("bench db schema: {e}"))?;
    Ok(conn)
}

/// Create `project_count` synthetic projects under `root`.
/// When `files_per_node_modules > 0`, each project gets a populated `node_modules/` tree (for sizing).
/// Otherwise each project gets `target/debug/deps/` (legacy synthetic bench).
pub fn generate_synthetic_fixture(
    root: &Path,
    project_count: usize,
) -> Result<(), String> {
    generate_synthetic_fixture_ex(root, project_count, 0)
}

pub fn generate_synthetic_fixture_ex(
    root: &Path,
    project_count: usize,
    files_per_node_modules: usize,
) -> Result<(), String> {
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
        if files_per_node_modules > 0 {
            let nm = proj.join("node_modules");
            fs::create_dir_all(&nm).map_err(|e| format!("mkdir node_modules: {e}"))?;
            for j in 0..files_per_node_modules {
                fs::write(nm.join(format!("pkg-{j:03}.dat")), vec![0u8; 512])
                    .map_err(|e| format!("write nm file: {e}"))?;
            }
        } else {
            fs::create_dir_all(proj.join("target").join("debug").join("deps"))
                .map_err(|e| format!("mkdir target: {e}"))?;
            fs::write(proj.join("target").join("debug").join("deps").join("stub"), b"x")
                .map_err(|e| format!("write stub: {e}"))?;
        }
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
        check_vcpkg_cache: false,
        check_conan_cache: false,
        check_ccache: false,
        check_sccache: false,
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
    run_scan_pipeline_bench_with_inventory(roots, req, concurrency_mode, fixture_projects, None)
}

pub fn run_scan_pipeline_bench_with_inventory(
    roots: &[String],
    req: &ScanRequest,
    concurrency_mode: &str,
    fixture_projects: usize,
    inventory: Option<BenchInventoryOpts<'_>>,
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
    let mut targets = discovery.targets;
    let mut candidates = Vec::with_capacity(targets.len());
    let mut classify_ms = 0u64;
    let mut size_ms = 0u64;
    let mut inventory_reused = 0usize;

    if let Some(inv) = &inventory {
        if inv.mode == ScanMode::Quick {
            let split = split_targets_with_inventory(inv.conn, inv.fingerprint, targets)?;
            inventory_reused = split.reused.len();
            candidates.extend(split.reused);
            targets = split.remaining;
        }
    }

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
                SizeWalkConfig::default(),
                || false,
                |_, _| {},
            );
            size_ms = size_ms.saturating_add(size_start.elapsed().as_millis() as u64);
        }
    }

    if let Some(inv) = &inventory {
        if inv.upsert_after && !candidates.is_empty() {
            upsert_candidates(inv.conn, inv.fingerprint, "deco-bench", &candidates)?;
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
        inventory_reused,
        scan_mode: req.scan_mode.clone(),
    })
}

/// Full scan (seed inventory) then quick scan on the same unchanged tree.
pub fn run_quick_update_comparison_bench(
    roots: &[String],
    req: &ScanRequest,
    concurrency_mode: &str,
    fixture_projects: usize,
    files_per_node_modules: usize,
) -> Result<QuickUpdateBenchResult, String> {
    let conn = open_bench_db()?;
    let fingerprint = inventory_fingerprint(req);

    let mut req_full = req.clone();
    req_full.scan_mode = "full".to_string();
    let full = run_scan_pipeline_bench_with_inventory(
        roots,
        &req_full,
        concurrency_mode,
        fixture_projects,
        Some(BenchInventoryOpts {
            conn: &conn,
            fingerprint: &fingerprint,
            mode: ScanMode::Full,
            upsert_after: true,
        }),
    )?;

    let mut req_quick = req.clone();
    req_quick.scan_mode = "quick".to_string();
    let quick = run_scan_pipeline_bench_with_inventory(
        roots,
        &req_quick,
        concurrency_mode,
        fixture_projects,
        Some(BenchInventoryOpts {
            conn: &conn,
            fingerprint: &fingerprint,
            mode: ScanMode::Quick,
            upsert_after: false,
        }),
    )?;

    let pipeline_full = full.pipeline_ms();
    let pipeline_quick = quick.pipeline_ms();
    let pipeline_speedup_ratio = speedup_ratio(pipeline_full, pipeline_quick);
    let total_speedup_ratio = speedup_ratio(full.total_ms, quick.total_ms);
    let inventory_reused = quick.inventory_reused;
    let inventory_reuse_ratio = if full.candidate_count == 0 {
        0.0
    } else {
        inventory_reused as f64 / full.candidate_count as f64
    };

    Ok(QuickUpdateBenchResult {
        full,
        quick,
        pipeline_speedup_ratio,
        total_speedup_ratio,
        inventory_reused,
        inventory_reuse_ratio,
        fixture_projects,
        files_per_node_modules,
    })
}

fn speedup_ratio(baseline_ms: u64, improved_ms: u64) -> f64 {
    if baseline_ms == 0 {
        // Sub-millisecond runs on fast CI hosts — treat as fully improved for gating.
        return if improved_ms == 0 { 1.0 } else { 0.0 };
    }
    (baseline_ms.saturating_sub(improved_ms)) as f64 / baseline_ms as f64
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

pub fn compare_quick_update_to_baseline(
    result: &QuickUpdateBenchResult,
    baseline: &QuickUpdateBenchBaseline,
) -> BenchCompareOutcome {
    let mut messages = Vec::new();
    let mut passed = true;

    if result.fixture_projects != baseline.fixture_projects {
        messages.push(format!(
            "note: fixture_projects {} (baseline {})",
            result.fixture_projects, baseline.fixture_projects
        ));
    }

    if result.pipeline_speedup_ratio + f64::EPSILON < baseline.min_pipeline_speedup_ratio {
        passed = false;
        messages.push(format!(
            "pipeline_speedup_ratio {:.1}% < min {:.1}% (full classify+size {} ms → quick {} ms)",
            result.pipeline_speedup_ratio * 100.0,
            baseline.min_pipeline_speedup_ratio * 100.0,
            result.full.pipeline_ms(),
            result.quick.pipeline_ms(),
        ));
    } else {
        messages.push(format!(
            "pipeline_speedup_ratio {:.1}% OK (min {:.1}%)",
            result.pipeline_speedup_ratio * 100.0,
            baseline.min_pipeline_speedup_ratio * 100.0,
        ));
    }

    if result.inventory_reuse_ratio + f64::EPSILON < baseline.min_inventory_reuse_ratio {
        passed = false;
        messages.push(format!(
            "inventory_reuse_ratio {:.1}% < min {:.1}% ({} / {} candidates)",
            result.inventory_reuse_ratio * 100.0,
            baseline.min_inventory_reuse_ratio * 100.0,
            result.inventory_reused,
            result.full.candidate_count,
        ));
    }

    if let Some(limits) = &baseline.limits {
        if result.full.total_ms > limits.full_total_ms_max {
            passed = false;
            messages.push(format!(
                "full.total_ms {} > max {}",
                result.full.total_ms, limits.full_total_ms_max
            ));
        }
        if result.quick.total_ms > limits.quick_total_ms_max {
            passed = false;
            messages.push(format!(
                "quick.total_ms {} > max {}",
                result.quick.total_ms, limits.quick_total_ms_max
            ));
        }
        if result.full.pipeline_ms() > limits.full_pipeline_ms_max {
            passed = false;
            messages.push(format!(
                "full pipeline_ms {} > max {}",
                result.full.pipeline_ms(),
                limits.full_pipeline_ms_max
            ));
        }
        if result.quick.pipeline_ms() > limits.quick_pipeline_ms_max {
            passed = false;
            messages.push(format!(
                "quick pipeline_ms {} > max {}",
                result.quick.pipeline_ms(),
                limits.quick_pipeline_ms_max
            ));
        }
    }

    if passed {
        messages.push(format!(
            "quick-update bench passed (total speedup {:.1}%, discover still runs on both passes)",
            result.total_speedup_ratio * 100.0
        ));
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

    #[test]
    fn quick_update_reuses_inventory_on_unchanged_fixture() {
        let root = default_fixture_parent().join(format!("qu-{}", uuid::Uuid::new_v4()));
        generate_synthetic_fixture_ex(&root, 8, QUICK_UPDATE_FILES_PER_NODE_MODULES).expect("fixture");
        let root_str = root.to_string_lossy().to_string();
        let mut req = default_bench_request(true);
        req.roots = vec![root_str.clone()];
        let result = run_quick_update_comparison_bench(
            &[root_str],
            &req,
            "auto",
            8,
            QUICK_UPDATE_FILES_PER_NODE_MODULES,
        )
        .expect("quick bench");
        assert!(
            result.inventory_reuse_ratio >= 0.99,
            "expected full reuse, got {:.2}",
            result.inventory_reuse_ratio
        );
        let pipeline_ms = result.full.pipeline_ms();
        if pipeline_ms >= 5 {
            assert!(
                result.pipeline_speedup_ratio >= 0.30,
                "expected >=30% pipeline speedup, got {:.1}% (full {} ms, quick {} ms)",
                result.pipeline_speedup_ratio * 100.0,
                pipeline_ms,
                result.quick.pipeline_ms(),
            );
        } else {
            assert!(
                result.pipeline_speedup_ratio >= 0.99,
                "sub-ms pipeline on this host; expected reuse-only win, speedup {:.1}%",
                result.pipeline_speedup_ratio * 100.0,
            );
        }
        let _ = fs::remove_dir_all(&root);
    }
}
