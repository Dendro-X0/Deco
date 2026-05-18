use super::disk_cleanup_config::ExtraDiscoverNames;
use super::ancestor_cache::AncestorCache;
use super::discovery_patterns::match_walk_pattern;
use super::ecosystem_globals::{
    discover_bun_global_caches, discover_cargo_registry_caches, discover_ccache_global_caches,
    discover_composer_global_caches, discover_conan_global_caches, discover_ide_global_caches,
    discover_jvm_global_caches, discover_npm_global_caches, discover_conda_pkgs_caches,
    discover_nuget_global_caches, discover_pip_global_caches, discover_pnpm_global_store,
    discover_sccache_global_caches, discover_uv_global_caches, discover_vcpkg_installed_caches,
    discover_yarn_global_caches, is_pnpm_store_root,
};
use super::project_detection::{
    dir_has_cpp_native_marker, is_bazel_output_dir_name, is_cpp_ide_dir_name, is_meson_build_dir_name,
    is_premake_build_dir_name, is_qmake_shadow_build_dir_name, is_xmake_build_dir_name,
    is_msvc_arch_dir_name, is_msvc_config_dir_name,
};
use super::path_policy::PathPolicy;
use super::types::{EcosystemScanOptions, Kind};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use walkdir::WalkDir;

/// Directory names skipped during discovery (saves walking Program Files, Windows, etc.).
const VOLUME_SKIP_DIR_NAMES: &[&str] = &[
    "Windows",
    "Program Files",
    "Program Files (x86)",
    "$Recycle.Bin",
    "System Volume Information",
    "Recovery",
    "PerfLogs",
    "Config.Msi",
    "MSOCache",
    "Boot",
    "efi",
    "OneDriveTemp",
    "Intel",
    "AMD",
    "NVIDIA",
    "WindowsApps",
];

pub type DiscoverProgressCallback = Arc<dyn Fn(u64, usize, &str) + Send + Sync>;

fn should_skip_volume_system_dir(dir_name: &str) -> bool {
    let lower = dir_name.to_lowercase();
    VOLUME_SKIP_DIR_NAMES
        .iter()
        .any(|n| lower == n.to_lowercase())
}

fn path_dedupe_key(p: &Path) -> String {
    let s = p.to_string_lossy().replace('/', "\\");
    if cfg!(windows) {
        s.to_lowercase()
    } else {
        s
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredTarget {
    pub kind: Kind,
    pub abs_path: String,
    pub mtime_ms: Option<i64>,
}

#[derive(Debug)]
pub struct DiscoveryResult {
    pub targets: Vec<DiscoveredTarget>,
    pub scanned_dirs: u64,
    pub warnings: Vec<String>,
    pub canceled: bool,
}

/// Do not descend into these directory names after recording them as targets (saves walk time).
pub const SKIP_DESCENT_DIR_NAMES: &[&str] = &[
    "node_modules",
    ".pnpm-store",
    "pnpm-store",
    "target",
    ".git",
    ".next",
    ".svelte-kit",
    ".astro",
    ".cache",
    "dist",
    "build",
    "dist-firefox",
    ".cargo-target",
    "pkg",
    "vendor",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".tox",
    "venv",
    ".venv",
    "obj",
];

pub fn should_skip_descent(dir_name: &str) -> bool {
    SKIP_DESCENT_DIR_NAMES.contains(&dir_name)
}

/// True when `path` is strictly inside a `node_modules` / `target` / … folder under `walk_root`.
///
/// Parent checks stop at `walk_root` so unrelated ancestors (e.g. repo `target/deco-bench-runs/`)
/// do not mark the whole scan tree as "inside target".
fn is_deeper_than_skip_descent_root(path: &Path, walk_root: &Path) -> bool {
    if path == walk_root || !path.starts_with(walk_root) {
        return false;
    }
    let mut current = path;
    while let Some(parent) = current.parent() {
        if parent == walk_root {
            break;
        }
        if !parent.starts_with(walk_root) {
            break;
        }
        if parent
            .file_name()
            .and_then(|n| n.to_str())
            .map(should_skip_descent)
            .unwrap_or(false)
        {
            return true;
        }
        current = parent;
    }
    false
}

const GO_ARTIFACT_DIR_NAMES: &[&str] = &["bin", "dist", "build", "bin-win"];

fn is_go_artifact_dir_name(name: &str, extra: &ExtraDiscoverNames) -> bool {
    GO_ARTIFACT_DIR_NAMES.contains(&name) || extra.go_artifacts.iter().any(|n| n == name)
}

fn detect_kind(
    entry_path: &Path,
    name: &str,
    profile: &str,
    extra: &ExtraDiscoverNames,
    eco: EcosystemScanOptions,
    cache: &mut AncestorCache,
    smart_discovery: bool,
) -> Option<Kind> {
    // Names that never need ancestor marker probes (saves HDD stat storms).
    match name {
        "node_modules" => return Some(Kind::NodeModules),
        ".pnpm-store" | "pnpm-store"
            if eco.check_pnpm_store && is_pnpm_store_root(entry_path) =>
        {
            return Some(Kind::PnpmGlobalStore);
        }
        "test-results" | "playwright-report" => return Some(Kind::PlaywrightArtifact),
        "target" | ".cargo-target" | "pkg" => return Some(Kind::RustArtifact),
        ".next" | ".svelte-kit" | ".astro" | ".cache" | "dist-firefox" => {
            return Some(Kind::BuildArtifact);
        }
        name if profile != "safe" && name.starts_with("cmake-build-") => {
            if cache.has_cmake_project_ancestor(entry_path, 6) {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        name if profile != "safe" && name == "out" => {
            if cache.has_cmake_project_ancestor(entry_path, 6)
                || cache.has_meson_project_ancestor(entry_path, 6)
            {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        name if profile != "safe" && is_meson_build_dir_name(name) => {
            if cache.has_meson_project_ancestor(entry_path, 6) {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        name if profile != "safe" && is_cpp_ide_dir_name(name) => {
            if cache.has_cpp_native_project_ancestor(entry_path, 6) {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        name if profile != "safe" && is_bazel_output_dir_name(name) => {
            if cache.has_bazel_project_ancestor(entry_path, 6) {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        name if profile != "safe" && is_xmake_build_dir_name(name) => {
            if cache.has_xmake_project_ancestor(entry_path, 6) {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        name if profile != "safe" && is_premake_build_dir_name(name) => {
            if cache.has_premake_project_ancestor(entry_path, 6) {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        name if profile != "safe" && is_qmake_shadow_build_dir_name(name) => {
            if cache.has_qmake_project_ancestor(entry_path, 6) {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        name if profile != "safe" && name == "obj" => {
            if cache.has_premake_project_ancestor(entry_path, 6)
                && !cache.has_dotnet_project_ancestor(entry_path, 6)
            {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        name if profile != "safe" && is_msvc_config_dir_name(name) => {
            if !cache.has_cpp_native_project_ancestor(entry_path, 6) {
                return None;
            }
            let parent = entry_path.parent()?;
            let parent_name = parent.file_name()?.to_str()?;
            if is_msvc_arch_dir_name(parent_name) || dir_has_cpp_native_marker(parent) {
                return Some(Kind::BuildArtifact);
            }
            if profile == "aggressive" {
                return Some(Kind::BuildArtifact);
            }
            return None;
        }
        ".turbo" | ".vite" | ".nuxt" | ".parcel-cache" | ".eslintcache" | ".tmp" | "tmp"
        | "temp" | "cache"
            if profile == "aggressive" =>
        {
            return Some(Kind::UnknownArtifact);
        }
        _ => {}
    }

    if extra.playwright_artifacts.iter().any(|n| n == name) {
        return Some(Kind::PlaywrightArtifact);
    }
    if extra.rust_artifacts.iter().any(|n| n == name) {
        return Some(Kind::RustArtifact);
    }
    if profile != "safe" && extra.build_artifacts.iter().any(|n| n == name) {
        return Some(Kind::BuildArtifact);
    }

    let needs_go = is_go_artifact_dir_name(name, extra) || name == "dist" || name == "build";
    let needs_py = eco.include_python_artifacts
        && (matches!(
            name,
            "__pycache__"
                | ".pytest_cache"
                | ".mypy_cache"
                | ".ruff_cache"
                | ".tox"
        ) || name.ends_with(".egg-info")
            || name == "dist"
            || name == "build");
    let needs_py_venv =
        eco.include_python_venv && (name == "venv" || name == ".venv");
    let needs_jvm = eco.include_jvm_artifacts && (name == "dist" || name == "build");
    let needs_dotnet =
        eco.include_dotnet_artifacts && (name == "bin" || name == "obj");

    let needs_ancestor = needs_go || needs_py || needs_py_venv || needs_jvm || needs_dotnet;
    if !needs_ancestor {
        return None;
    }

    const MAX_ASCEND: u32 = 6;
    let has_go = needs_go && cache.has_go_mod_ancestor(entry_path, MAX_ASCEND);
    let has_py = (needs_py || needs_py_venv)
        && cache.has_python_project_ancestor(entry_path, MAX_ASCEND);
    let has_jvm = needs_jvm && cache.has_jvm_project_ancestor(entry_path, MAX_ASCEND);
    let has_dotnet = needs_dotnet && cache.has_dotnet_project_ancestor(entry_path, MAX_ASCEND);

    if eco.include_python_venv && (name == "venv" || name == ".venv") && has_py {
        return Some(Kind::PythonVenv);
    }

    if eco.include_dotnet_artifacts && (name == "bin" || name == "obj") && has_dotnet && !has_go {
        return Some(Kind::DotNetArtifact);
    }

    if is_go_artifact_dir_name(name, extra) {
        if name == "bin" {
            return if has_go { Some(Kind::GoArtifact) } else { None };
        }
        if matches!(name, "dist" | "build" | "bin-win") {
            return if has_go { Some(Kind::GoArtifact) } else { None };
        }
        if extra.go_artifacts.iter().any(|n| n == name) {
            return if has_go { Some(Kind::GoArtifact) } else { None };
        }
    }

    if eco.include_python_artifacts {
        if matches!(
            name,
            "__pycache__" | ".pytest_cache" | ".mypy_cache" | ".ruff_cache" | ".tox"
        ) && has_py
        {
            return Some(Kind::PythonArtifact);
        }
        if name.ends_with(".egg-info") && has_py {
            return Some(Kind::PythonArtifact);
        }
    }

    if name == "dist" || name == "build" {
        if has_go {
            return Some(Kind::GoArtifact);
        }
        if eco.include_jvm_artifacts && has_jvm {
            return Some(Kind::JvmArtifact);
        }
        if eco.include_python_artifacts && has_py {
            return Some(Kind::PythonArtifact);
        }
        return Some(Kind::BuildArtifact);
    }

    match_walk_pattern(entry_path, name, eco, smart_discovery)
}

fn dedupe_roots(roots: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut out = Vec::new();
    for r in roots {
        let key = std::fs::canonicalize(Path::new(r))
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| PathBuf::from(r).to_string_lossy().to_string());
        let norm = if cfg!(windows) {
            key.to_lowercase()
        } else {
            key
        };
        if seen.insert(norm) {
            out.push(r.clone());
        }
    }
    out
}

fn dedupe_targets_by_canonical_path(
    targets: Vec<DiscoveredTarget>,
    warnings: &mut Vec<String>,
) -> Vec<DiscoveredTarget> {
    let mut seen: HashSet<String> = HashSet::new();
    let mut out = Vec::with_capacity(targets.len());
    for t in targets {
        let key = path_dedupe_key(Path::new(&t.abs_path));
        if seen.insert(key) {
            out.push(t);
        } else {
            warnings.push(format!(
                "Skipped duplicate target (same physical path as an earlier candidate): {}",
                t.abs_path
            ));
        }
    }
    out
}

struct RootDiscovery {
    targets: Vec<DiscoveredTarget>,
    scanned_dirs: u64,
    warnings: Vec<String>,
    canceled: bool,
}

/// Minimum immediate child folders before splitting discovery across workers.
const MIN_PARALLEL_CHILDREN: usize = 2;

fn list_discover_child_roots(
    root_path: &Path,
    excludes: &[String],
    policy: &PathPolicy,
) -> Vec<String> {
    let Ok(entries) = std::fs::read_dir(root_path) else {
        return vec![];
    };
    let mut children = Vec::new();
    for entry in entries.flatten() {
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if !file_type.is_dir() {
            continue;
        }
        let dir_name = entry.file_name().to_string_lossy().to_string();
        if should_skip_volume_system_dir(&dir_name) {
            continue;
        }
        let abs = entry.path().to_string_lossy().to_string();
        if policy.should_prune(&abs) {
            continue;
        }
        if excludes.iter().any(|pattern| abs.contains(pattern)) {
            continue;
        }
        children.push(abs);
    }
    children
}

fn merge_root_discoveries(partials: Vec<RootDiscovery>) -> RootDiscovery {
    let mut merged = RootDiscovery {
        targets: vec![],
        scanned_dirs: 0,
        warnings: vec![],
        canceled: false,
    };
    for part in partials {
        merged.scanned_dirs += part.scanned_dirs;
        merged.targets.extend(part.targets);
        merged.warnings.extend(part.warnings);
        merged.canceled |= part.canceled;
    }
    merged
}

fn discover_under_root(
    root: &str,
    max_depth: u32,
    profile: &str,
    excludes: &[String],
    policy: &PathPolicy,
    eco: EcosystemScanOptions,
    extra_names: &ExtraDiscoverNames,
    smart_discovery: bool,
    cancel: Option<&AtomicBool>,
    progress: Option<&DiscoverProgressCallback>,
    total_scanned: &AtomicU64,
    discover_workers: usize,
    allow_parallel_split: bool,
) -> RootDiscovery {
    let mut warnings = vec![];
    let mut scanned_dirs = 0u64;
    let mut targets = vec![];
    let mut canceled = false;

    let root_path = PathBuf::from(root);
    if !root_path.exists() {
        warnings.push(format!("Root does not exist: {root}"));
        return RootDiscovery {
            targets,
            scanned_dirs,
            warnings,
            canceled,
        };
    }

    if cancel.is_some_and(|t| t.load(Ordering::Relaxed)) {
        return RootDiscovery {
            targets,
            scanned_dirs,
            warnings: vec!["Scan canceled during discovery.".to_string()],
            canceled: true,
        };
    }

    if allow_parallel_split && discover_workers > 1 && max_depth > 0 {
        let children = list_discover_child_roots(&root_path, excludes, policy);
        if children.len() >= MIN_PARALLEL_CHILDREN {
            use rayon::prelude::*;
            let partials: Vec<RootDiscovery> = children
                .par_iter()
                .map(|child| {
                    discover_under_root(
                        child,
                        max_depth.saturating_sub(1),
                        profile,
                        excludes,
                        policy,
                        eco,
                        extra_names,
                        smart_discovery,
                        cancel,
                        progress,
                        total_scanned,
                        discover_workers,
                        false,
                    )
                })
                .collect();
            let merged = merge_root_discoveries(partials);
            if merged.scanned_dirs > 0 || !merged.targets.is_empty() {
                return merged;
            }
            warnings.push(
                "Parallel discover returned no directories; falling back to serial walk."
                    .to_string(),
            );
        }
    }

    let mut walker = WalkDir::new(&root_path)
        .max_depth((max_depth + 1) as usize)
        .follow_links(false)
        .into_iter();

    const PROGRESS_EVERY: u64 = 800;
    let mut ancestor_cache = AncestorCache::default();

    while let Some(entry_result) = walker.next() {
        if cancel.is_some_and(|t| t.load(Ordering::Relaxed)) {
            canceled = true;
            warnings.push("Scan canceled during discovery.".to_string());
            break;
        }

        let entry = match entry_result {
            Ok(entry) => entry,
            Err(err) => {
                warnings.push(format!(
                    "Walk error under {}: {}",
                    err.path()
                        .map(|p| p.display().to_string())
                        .unwrap_or_else(|| "?".into()),
                    err
                ));
                continue;
            }
        };

        if entry.file_type().is_dir() {
            let abs = entry.path().to_string_lossy().to_string();
            if policy.should_prune(&abs) {
                walker.skip_current_dir();
                continue;
            }
            if excludes.iter().any(|pattern| abs.contains(pattern)) {
                walker.skip_current_dir();
                continue;
            }
        }

        if !entry.file_type().is_dir() {
            continue;
        }

        let dir_name = entry.file_name().to_string_lossy().to_string();

        if is_deeper_than_skip_descent_root(entry.path(), &root_path) {
            walker.skip_current_dir();
            continue;
        }

        if should_skip_volume_system_dir(&dir_name) {
            walker.skip_current_dir();
            continue;
        }

        scanned_dirs += 1;
        let total = total_scanned.fetch_add(1, Ordering::Relaxed) + 1;

        if let Some(kind) = detect_kind(
            entry.path(),
            &dir_name,
            profile,
            extra_names,
            eco,
            &mut ancestor_cache,
            smart_discovery,
        ) {
            let abs = entry.path().to_string_lossy().to_string();
            let mtime_ms = std::fs::metadata(entry.path())
                .ok()
                .and_then(|m| m.modified().ok())
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64);
            targets.push(DiscoveredTarget {
                kind,
                abs_path: abs,
                mtime_ms,
            });
        }

        if should_skip_descent(&dir_name) {
            walker.skip_current_dir();
        }

        if total % PROGRESS_EVERY == 0 {
            if let Some(cb) = progress {
                cb(total, targets.len(), root);
            }
        }
    }

    RootDiscovery {
        targets,
        scanned_dirs,
        warnings,
        canceled,
    }
}

pub fn discover_targets(
    roots: &[String],
    max_depth: u32,
    profile: &str,
    excludes: &[String],
    policy: &PathPolicy,
    eco: EcosystemScanOptions,
    check_go_cache: bool,
    extra_names: &ExtraDiscoverNames,
    smart_discovery: bool,
    discover_workers: usize,
    cancel: Option<&AtomicBool>,
    progress: Option<DiscoverProgressCallback>,
) -> DiscoveryResult {
    let workers = discover_workers.max(1);
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(workers)
        .build()
        .expect("discover thread pool");

    pool.install(|| {
        discover_targets_inner(
            roots,
            max_depth,
            profile,
            excludes,
            policy,
            eco,
            check_go_cache,
            extra_names,
            smart_discovery,
            workers,
            cancel,
            progress,
        )
    })
}

fn discover_targets_inner(
    roots: &[String],
    max_depth: u32,
    profile: &str,
    excludes: &[String],
    policy: &PathPolicy,
    eco: EcosystemScanOptions,
    check_go_cache: bool,
    extra_names: &ExtraDiscoverNames,
    smart_discovery: bool,
    discover_workers: usize,
    cancel: Option<&AtomicBool>,
    progress: Option<DiscoverProgressCallback>,
) -> DiscoveryResult {
    let mut warnings = vec![];
    let mut scanned_dirs = 0u64;
    let mut all_targets: Vec<DiscoveredTarget> = vec![];
    let mut canceled = false;

    let roots_only = dedupe_roots(roots);
    let total_scanned = AtomicU64::new(0);

    if roots_only.len() > 1 {
        use rayon::prelude::*;
        let partials: Vec<RootDiscovery> = roots_only
            .par_iter()
            .map(|root| {
                discover_under_root(
                    root,
                    max_depth,
                    profile,
                    excludes,
                    policy,
                    eco,
                    extra_names,
                    smart_discovery,
                    cancel,
                    progress.as_ref(),
                    &total_scanned,
                    discover_workers,
                    true,
                )
            })
            .collect();
        for part in partials {
            scanned_dirs += part.scanned_dirs;
            all_targets.extend(part.targets);
            warnings.extend(part.warnings);
            canceled |= part.canceled;
        }
    } else if let Some(root) = roots_only.first() {
        let part = discover_under_root(
            root,
            max_depth,
            profile,
            excludes,
            policy,
            eco,
            extra_names,
            smart_discovery,
            cancel,
            progress.as_ref(),
            &total_scanned,
            discover_workers,
            true,
        );
        scanned_dirs = part.scanned_dirs;
        all_targets = part.targets;
        warnings = part.warnings;
        canceled = part.canceled;
    }

    if check_go_cache && !canceled {
        let (go_cache_targets, go_cache_warnings) = discover_go_cache_targets();
        all_targets.extend(go_cache_targets);
        warnings.extend(go_cache_warnings);
    }
    if eco.check_jvm_global_cache && !canceled {
        let (jvm_targets, jvm_warnings) = discover_jvm_global_caches();
        all_targets.extend(jvm_targets);
        warnings.extend(jvm_warnings);
    }
    if eco.check_ide_global_cache && !canceled {
        let (ide_targets, ide_warnings) = discover_ide_global_caches();
        all_targets.extend(ide_targets);
        warnings.extend(ide_warnings);
    }
    if eco.check_npm_cache && !canceled {
        let (npm_targets, npm_warnings) = discover_npm_global_caches();
        all_targets.extend(npm_targets);
        warnings.extend(npm_warnings);
    }
    if eco.check_pnpm_store && !canceled {
        let (pnpm_targets, pnpm_warnings) = discover_pnpm_global_store();
        all_targets.extend(pnpm_targets);
        warnings.extend(pnpm_warnings);
    }
    if eco.check_yarn_cache && !canceled {
        let (yarn_targets, yarn_warnings) = discover_yarn_global_caches();
        all_targets.extend(yarn_targets);
        warnings.extend(yarn_warnings);
    }
    if eco.check_pip_cache && !canceled {
        let (pip_targets, pip_warnings) = discover_pip_global_caches();
        all_targets.extend(pip_targets);
        warnings.extend(pip_warnings);
    }
    if eco.check_uv_cache && !canceled {
        let (uv_targets, uv_warnings) = discover_uv_global_caches();
        all_targets.extend(uv_targets);
        warnings.extend(uv_warnings);
    }
    if eco.check_conda_pkgs_cache && !canceled {
        let (conda_targets, conda_warnings) = discover_conda_pkgs_caches();
        all_targets.extend(conda_targets);
        warnings.extend(conda_warnings);
    }
    if eco.check_cargo_registry && !canceled {
        let (cargo_targets, cargo_warnings) = discover_cargo_registry_caches();
        all_targets.extend(cargo_targets);
        warnings.extend(cargo_warnings);
    }
    if eco.check_bun_cache && !canceled {
        let (bun_targets, bun_warnings) = discover_bun_global_caches();
        all_targets.extend(bun_targets);
        warnings.extend(bun_warnings);
    }
    if eco.check_composer_cache && !canceled {
        let (composer_targets, composer_warnings) = discover_composer_global_caches();
        all_targets.extend(composer_targets);
        warnings.extend(composer_warnings);
    }
    if eco.check_nuget_cache && !canceled {
        let (nuget_targets, nuget_warnings) = discover_nuget_global_caches();
        all_targets.extend(nuget_targets);
        warnings.extend(nuget_warnings);
    }
    if eco.check_vcpkg_cache && !canceled {
        let (vcpkg_targets, vcpkg_warnings) = discover_vcpkg_installed_caches();
        all_targets.extend(vcpkg_targets);
        warnings.extend(vcpkg_warnings);
    }
    if eco.check_conan_cache && !canceled {
        let (conan_targets, conan_warnings) = discover_conan_global_caches();
        all_targets.extend(conan_targets);
        warnings.extend(conan_warnings);
    }
    if eco.check_ccache && !canceled {
        let (ccache_targets, ccache_warnings) = discover_ccache_global_caches();
        all_targets.extend(ccache_targets);
        warnings.extend(ccache_warnings);
    }
    if eco.check_sccache && !canceled {
        let (sccache_targets, sccache_warnings) = discover_sccache_global_caches();
        all_targets.extend(sccache_targets);
        warnings.extend(sccache_warnings);
    }

    let targets = dedupe_targets_by_canonical_path(all_targets, &mut warnings);

    DiscoveryResult {
        targets,
        scanned_dirs,
        warnings,
        canceled,
    }
}

fn discover_go_cache_targets() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let mut warnings = vec![];
    let mut seen_paths: HashSet<String> = HashSet::new();

    for key in ["GOCACHE", "GOMODCACHE"] {
        let output = Command::new("go").args(["env", key]).output();
        let Ok(out) = output else {
            warnings.push(format!("`go env {key}` failed: go binary not available or not on PATH"));
            continue;
        };
        if !out.status.success() {
            warnings.push(format!("`go env {key}` exited with status {}", out.status));
            continue;
        }
        let value = String::from_utf8_lossy(&out.stdout).trim().to_string();
        if value.is_empty() {
            continue;
        }
        let norm = if cfg!(windows) {
            value.to_lowercase()
        } else {
            value.clone()
        };
        if !seen_paths.insert(norm) {
            continue;
        }
        let mtime_ms = std::fs::metadata(&value)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64);
        targets.push(DiscoveredTarget {
            kind: Kind::GoGlobalCache,
            abs_path: value,
            mtime_ms,
        });
    }
    (targets, warnings)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::disk_cleanup_config::ExtraDiscoverNames;
    use std::fs::{create_dir_all, remove_dir_all};
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_root(prefix: &str) -> PathBuf {
        let base = std::env::current_dir()
            .expect("cwd")
            .join("..")
            .join(".tmp-rust-tests");
        create_dir_all(&base).expect("create base");
        let root = base.join(format!("deco-rust-{prefix}-{}", Uuid::new_v4()));
        create_dir_all(&root).expect("create temp root");
        root
    }

    #[test]
    fn discovers_node_modules_target() {
        let root = temp_root("scan-nm");
        create_dir_all(root.join("project").join("node_modules")).expect("create nm");

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            6,
            "safe",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        assert!(result
            .targets
            .iter()
            .any(|t| t.kind == Kind::NodeModules && t.abs_path.contains("node_modules")));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn discovers_python_cache_with_pyproject() {
        use std::fs::write;

        let root = temp_root("scan-py");
        let project = root.join("pyapp");
        create_dir_all(&project).expect("create project");
        write(project.join("pyproject.toml"), "[project]\nname=\"x\"\n").expect("write pyproject");
        create_dir_all(project.join("src").join("__pycache__")).expect("create cache");

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            8,
            "safe",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        assert!(result.targets.iter().any(|t| {
            t.kind == Kind::PythonArtifact && t.abs_path.contains("__pycache__")
        }));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn discovers_go_bin_only_with_go_mod_ancestor() {
        use std::fs::write;

        let root = temp_root("scan-go-bin");
        create_dir_all(root.join("goproj").join("bin")).expect("create goproj bin");
        write(root.join("goproj").join("go.mod"), "module example.com/app\n").expect("write go.mod");
        create_dir_all(root.join("nogo").join("bin")).expect("create nogo bin");

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            6,
            "safe",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        let go_bins: Vec<_> = result
            .targets
            .iter()
            .filter(|t| t.kind == Kind::GoArtifact && t.abs_path.ends_with("bin"))
            .collect();
        assert_eq!(go_bins.len(), 1);
        assert!(go_bins[0].abs_path.contains("goproj"));
        assert!(!result.targets.iter().any(|t| t.abs_path.contains("nogo") && t.kind == Kind::GoArtifact));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn does_not_descend_into_node_modules() {
        use std::fs::write;

        let root = temp_root("scan-prune-nm");
        let project = root.join("app");
        create_dir_all(&project).expect("create project");
        write(project.join("package.json"), "{}").expect("write package");
        create_dir_all(project.join("node_modules").join(".cache").join("deep")).expect("create deep");
        write(
            project.join("node_modules").join(".cache").join("deep").join("marker.txt"),
            "x",
        )
        .expect("write marker");

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            8,
            "aggressive",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        assert!(result.targets.iter().any(|t| t.kind == Kind::NodeModules));
        assert!(
            !result
                .targets
                .iter()
                .any(|t| t.abs_path.contains(".cache") && t.abs_path.contains("deep"))
        );

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn discover_honors_cancel_token() {
        let root = temp_root("scan-cancel-discover");
        create_dir_all(root.join("a")).expect("create a");

        let cancel = AtomicBool::new(true);
        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            6,
            "safe",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            Some(&cancel),
            None,
        );

        assert!(result.canceled);

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn does_not_include_go_global_cache_without_flag() {
        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[],
            6,
            "safe",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );
        assert!(!result
            .targets
            .iter()
            .any(|t| t.kind == Kind::GoGlobalCache));
    }

    #[test]
    fn discovers_xmake_premake_qmake_on_balanced() {
        use std::fs::write;

        let root = temp_root("scan-native-alt");
        let xmake = root.join("xmake-app");
        create_dir_all(&xmake).expect("create xmake");
        write(xmake.join("xmake.lua"), "set_project(\"demo\")\n").expect("write xmake");
        create_dir_all(xmake.join(".build")).expect("create .build");

        let premake = root.join("premake-app");
        create_dir_all(&premake).expect("create premake");
        write(premake.join("premake5.lua"), "workspace \"w\"\n").expect("write premake");
        create_dir_all(premake.join("bin-int")).expect("create bin-int");

        let qt = root.join("qt-app");
        create_dir_all(&qt).expect("create qt");
        write(qt.join("app.pro"), "TEMPLATE = app\n").expect("write pro");
        create_dir_all(qt.join("build-Desktop-Debug")).expect("create qt build");

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            8,
            "balanced",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        assert!(result.targets.iter().any(|t| t.abs_path.ends_with(".build")));
        assert!(result.targets.iter().any(|t| t.abs_path.ends_with("bin-int")));
        assert!(result
            .targets
            .iter()
            .any(|t| t.abs_path.ends_with("build-Desktop-Debug")));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn discovers_bazel_output_on_balanced() {
        use std::fs::write;

        let root = temp_root("scan-bazel");
        write(root.join("MODULE.bazel"), "module(name = \"demo\")\n").expect("write module");
        create_dir_all(root.join("bazel-out")).expect("create bazel-out");

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            8,
            "balanced",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        assert!(result.targets.iter().any(|t| {
            t.kind == Kind::BuildArtifact && t.abs_path.ends_with("bazel-out")
        }));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn discovers_meson_builddir_and_cmake_out_on_balanced() {
        use std::fs::write;

        let root = temp_root("scan-cpp-native");
        let cmake = root.join("cmake-app");
        create_dir_all(&cmake).expect("create cmake app");
        write(cmake.join("CMakeLists.txt"), "cmake_minimum_required(VERSION 3.16)\n")
            .expect("write cmake");
        create_dir_all(cmake.join("out")).expect("create out");

        let meson = root.join("meson-app");
        create_dir_all(&meson).expect("create meson app");
        write(meson.join("meson.build"), "project('demo', 'c')\n").expect("write meson");
        create_dir_all(meson.join("builddir")).expect("create builddir");

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            8,
            "balanced",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        assert!(result.targets.iter().any(|t| {
            t.kind == Kind::BuildArtifact && t.abs_path.ends_with("out")
        }));
        assert!(result.targets.iter().any(|t| {
            t.kind == Kind::BuildArtifact && t.abs_path.ends_with("builddir")
        }));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn discovers_dist_firefox_as_build_artifact() {
        let root = temp_root("scan-firefox");
        create_dir_all(root.join("web").join("dist-firefox")).expect("create dist-firefox");

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            6,
            "safe",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        assert!(result.targets.iter().any(|t| {
            t.kind == Kind::BuildArtifact && t.abs_path.ends_with("dist-firefox")
        }));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn prunes_protected_runtime_path() {
        let root = temp_root("scan-prune");
        create_dir_all(
            root.join("apps")
                .join("Cursor")
                .join("resources")
                .join("app")
                .join("node_modules"),
        )
        .expect("create runtime nm");

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            8,
            "safe",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        assert!(!result
            .targets
            .iter()
            .any(|t| t.abs_path.to_lowercase().contains("resources")
                && t.abs_path.to_lowercase().contains("app")));

        remove_dir_all(root).expect("cleanup");
    }

    #[cfg(unix)]
    #[test]
    fn dedupes_node_modules_seen_via_symlink_and_real_path() {
        use std::fs::write;
        use std::os::unix::fs::symlink;

        let root = temp_root("symlink-nm");
        let a = root.join("a");
        create_dir_all(a.join("node_modules")).unwrap();
        write(a.join("package.json"), "{}").unwrap();
        let b = root.join("b");
        create_dir_all(&b).unwrap();
        symlink(a.join("node_modules"), b.join("node_modules")).unwrap();

        let policy = PathPolicy::new(vec![], vec![]);
        let result = discover_targets(
            &[root.to_string_lossy().to_string()],
            10,
            "safe",
            &[],
            &policy,
            EcosystemScanOptions::default(),
            false,
            &ExtraDiscoverNames::default(),
            false,
            6,
            None,
            None,
        );

        let nm: Vec<_> = result
            .targets
            .iter()
            .filter(|t| t.kind == Kind::NodeModules)
            .collect();
        assert_eq!(nm.len(), 1, "canonical dedupe should collapse symlink + real dir");

        remove_dir_all(root).expect("cleanup");
    }
}
