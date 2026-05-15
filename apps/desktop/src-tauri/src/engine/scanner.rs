use super::disk_cleanup_config::ExtraDiscoverNames;
use super::ecosystem_globals::{discover_ide_global_caches, discover_jvm_global_caches};
use super::path_policy::PathPolicy;
use super::project_detection::{
    has_dotnet_project_ancestor, has_go_mod_ancestor, has_jvm_project_ancestor,
    has_python_project_ancestor,
};
use super::types::{EcosystemScanOptions, Kind};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use walkdir::WalkDir;

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
) -> Option<Kind> {
    let has_go = has_go_mod_ancestor(entry_path, 6);
    let has_py = has_python_project_ancestor(entry_path, 6);
    let has_jvm = has_jvm_project_ancestor(entry_path, 6);
    let has_dotnet = has_dotnet_project_ancestor(entry_path, 6);

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

    match name {
        "node_modules" => Some(Kind::NodeModules),
        "test-results" | "playwright-report" => Some(Kind::PlaywrightArtifact),
        "target" | ".cargo-target" | "pkg" => Some(Kind::RustArtifact),
        ".next" | ".svelte-kit" | ".astro" | ".cache" | "dist-firefox" => Some(Kind::BuildArtifact),
        ".turbo" | ".vite" | ".nuxt" | ".parcel-cache" | ".eslintcache" | ".tmp" | "tmp"
        | "temp" | "cache"
            if profile == "aggressive" =>
        {
            Some(Kind::UnknownArtifact)
        }
        _ => None,
    }
    .or_else(|| {
        if extra
            .playwright_artifacts
            .iter()
            .any(|n| n == name)
        {
            return Some(Kind::PlaywrightArtifact);
        }
        if extra.rust_artifacts.iter().any(|n| n == name) {
            return Some(Kind::RustArtifact);
        }
        if profile != "safe" {
            if extra.build_artifacts.iter().any(|n| n == name) {
                return Some(Kind::BuildArtifact);
            }
        }
        None
    })
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
    let mut seen: HashSet<PathBuf> = HashSet::new();
    let mut out = Vec::with_capacity(targets.len());
    for t in targets {
        let p = Path::new(&t.abs_path);
        let key = std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
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

pub fn discover_targets(
    roots: &[String],
    max_depth: u32,
    profile: &str,
    excludes: &[String],
    policy: &PathPolicy,
    eco: EcosystemScanOptions,
    check_go_cache: bool,
    extra_names: &ExtraDiscoverNames,
    cancel: Option<&AtomicBool>,
) -> DiscoveryResult {
    let mut warnings = vec![];
    let mut scanned_dirs = 0u64;
    let mut all_targets: Vec<DiscoveredTarget> = vec![];
    let mut canceled = false;

    let roots_only = dedupe_roots(roots);

    for root in roots_only {
        let root_path = PathBuf::from(&root);
        if !root_path.exists() {
            warnings.push(format!("Root does not exist: {root}"));
            continue;
        }

        let mut walker = WalkDir::new(&root_path)
            .max_depth((max_depth + 1) as usize)
            .follow_links(false)
            .into_iter();

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

            scanned_dirs += 1;
            let dir_name = entry.file_name().to_string_lossy().to_string();

            if let Some(kind) = detect_kind(entry.path(), &dir_name, profile, extra_names, eco) {
                let abs = entry.path().to_string_lossy().to_string();
                let mtime_ms = std::fs::metadata(entry.path())
                    .ok()
                    .and_then(|m| m.modified().ok())
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|d| d.as_millis() as i64);
                all_targets.push(DiscoveredTarget {
                    kind,
                    abs_path: abs,
                    mtime_ms,
                });
            }

            if should_skip_descent(&dir_name) {
                walker.skip_current_dir();
            }
        }

        if canceled {
            break;
        }
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
            Some(&cancel),
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
            None,
        );
        assert!(!result
            .targets
            .iter()
            .any(|t| t.kind == Kind::GoGlobalCache));
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
