//! Repo-local `.deco/disk-cleanup.json` — same shape as the CLI file (`apps/cli/config.schema.json`).
//! Loaded per scan root (and optionally cwd) and merged into `ScanRequest` path lists + extra discovery names.

use serde::Deserialize;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

/// Extra directory **names** (not paths) merged from repo config files, fed into [`super::scanner::discover_targets`].
#[derive(Debug, Clone, Default)]
pub struct ExtraDiscoverNames {
    pub build_artifacts: Vec<String>,
    pub rust_artifacts: Vec<String>,
    pub go_artifacts: Vec<String>,
    pub playwright_artifacts: Vec<String>,
}

#[derive(Debug, Clone, Default)]
pub struct MergedDiskCleanupLayers {
    pub exclude_abs_path_contains: Vec<String>,
    pub extra_protected_path_contains: Vec<String>,
    pub allow_path_contains: Vec<String>,
    pub extra_names: ExtraDiscoverNames,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DiskFile {
    exclude_abs_path_contains: Option<Vec<String>>,
    safety: Option<Safety>,
    additional_dir_names: Option<AdditionalDirNames>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Safety {
    extra_protected_path_contains: Option<Vec<String>>,
    allow_path_contains: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AdditionalDirNames {
    build_artifacts: Option<Vec<String>>,
    rust_artifacts: Option<Vec<String>>,
    go_artifacts: Option<Vec<String>>,
    playwright_artifacts: Option<Vec<String>>,
}

fn disk_config_path_under_root(root: &str) -> PathBuf {
    Path::new(root).join(".deco").join("disk-cleanup.json")
}

fn merge_unique_vec(into: &mut BTreeSet<String>, items: &[String]) {
    for s in items {
        if !s.is_empty() {
            into.insert(s.clone());
        }
    }
}

/// Collect and merge all `.deco/disk-cleanup.json` files found under each scan `root`, plus
/// `[cwd]/.deco/disk-cleanup.json` when cwd is distinct.
pub fn merge_disk_cleanup_layers(roots: &[String]) -> Result<MergedDiskCleanupLayers, String> {
    let mut paths_to_try: Vec<PathBuf> = Vec::new();
    for r in roots {
        let p = disk_config_path_under_root(r);
        if !paths_to_try.contains(&p) {
            paths_to_try.push(p);
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        let p = cwd.join(".deco").join("disk-cleanup.json");
        if !paths_to_try.contains(&p) {
            paths_to_try.push(p);
        }
    }

    let mut excludes = BTreeSet::new();
    let mut extra_protected = BTreeSet::new();
    let mut allow = BTreeSet::new();
    let mut build = BTreeSet::new();
    let mut rust = BTreeSet::new();
    let mut go = BTreeSet::new();
    let mut playwright = BTreeSet::new();

    for path in paths_to_try {
        if !path.is_file() {
            continue;
        }
        let text =
            std::fs::read_to_string(&path).map_err(|e| format!("failed reading {}: {e}", path.display()))?;
        let file: DiskFile = serde_json::from_str(&text)
            .map_err(|e| format!("invalid JSON in {}: {e}", path.display()))?;

        if let Some(v) = file.exclude_abs_path_contains {
            merge_unique_vec(&mut excludes, &v);
        }
        if let Some(s) = file.safety {
            if let Some(v) = s.extra_protected_path_contains {
                merge_unique_vec(&mut extra_protected, &v);
            }
            if let Some(v) = s.allow_path_contains {
                merge_unique_vec(&mut allow, &v);
            }
        }
        if let Some(a) = file.additional_dir_names {
            if let Some(v) = a.build_artifacts {
                merge_unique_vec(&mut build, &v);
            }
            if let Some(v) = a.rust_artifacts {
                merge_unique_vec(&mut rust, &v);
            }
            if let Some(v) = a.go_artifacts {
                merge_unique_vec(&mut go, &v);
            }
            if let Some(v) = a.playwright_artifacts {
                merge_unique_vec(&mut playwright, &v);
            }
        }
    }

    Ok(MergedDiskCleanupLayers {
        exclude_abs_path_contains: excludes.into_iter().collect(),
        extra_protected_path_contains: extra_protected.into_iter().collect(),
        allow_path_contains: allow.into_iter().collect(),
        extra_names: ExtraDiscoverNames {
            build_artifacts: build.into_iter().collect(),
            rust_artifacts: rust.into_iter().collect(),
            go_artifacts: go.into_iter().collect(),
            playwright_artifacts: playwright.into_iter().collect(),
        },
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, write};
    use std::path::PathBuf;
    use uuid::Uuid;

    fn tmp_base() -> PathBuf {
        std::env::current_dir()
            .unwrap()
            .join("..")
            .join(".tmp-rust-tests")
    }

    #[test]
    fn merges_exclude_from_repo_config() {
        let base = tmp_base();
        create_dir_all(&base).unwrap();
        let root = base.join(format!("m3-{}", Uuid::new_v4()));
        create_dir_all(root.join(".deco")).unwrap();
        let cfg = root.join(".deco").join("disk-cleanup.json");
        write(
            &cfg,
            r#"{
  "maxDepth": 6,
  "targets": {
    "nodeModules": true,
    "buildArtifacts": true,
    "rustArtifacts": true,
    "goArtifacts": false,
    "playwrightArtifacts": true
  },
  "excludeAbsPathContains": ["/NEVER_SCAN_THIS/"]
}"#,
        )
        .unwrap();

        let merged = merge_disk_cleanup_layers(&[root.to_string_lossy().to_string()]).unwrap();
        assert!(merged
            .exclude_abs_path_contains
            .iter()
            .any(|s| s.contains("NEVER_SCAN_THIS")));

        let _ = std::fs::remove_dir_all(&root);
    }
}
