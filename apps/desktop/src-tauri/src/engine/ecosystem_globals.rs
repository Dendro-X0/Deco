use super::scanner::DiscoveredTarget;
use super::types::Kind;
use std::path::{Path, PathBuf};
use std::process::Command;

fn user_home() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("USERPROFILE").map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

fn dir_mtime_ms(path: &Path) -> Option<i64> {
    std::fs::metadata(path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
}

fn push_global_cache(targets: &mut Vec<DiscoveredTarget>, path: PathBuf, kind: Kind) {
    if !path.is_dir() {
        return;
    }
    targets.push(DiscoveredTarget {
        kind,
        abs_path: path.to_string_lossy().to_string(),
        mtime_ms: dir_mtime_ms(&path),
    });
}

fn is_npm_cache_root(path: &Path) -> bool {
    path.is_dir() && path.join("_cacache").is_dir()
}

fn is_pnpm_store_root(path: &Path) -> bool {
    path.is_dir() && path.join("v3").is_dir()
}

fn npm_cache_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(v) = std::env::var("NPM_CONFIG_CACHE") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }
    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(local).join("npm-cache"));
        }
        if let Ok(appdata) = std::env::var("APPDATA") {
            paths.push(PathBuf::from(appdata).join("npm-cache"));
        }
    }
    #[cfg(not(windows))]
    {
        if let Some(home) = user_home() {
            paths.push(home.join(".npm"));
        }
    }
    paths
}

fn pnpm_store_candidate_paths(warnings: &mut Vec<String>) -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(v) = std::env::var("PNPM_STORE_PATH") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }

    let output = Command::new("pnpm").args(["store", "path"]).output();
    match output {
        Ok(out) if out.status.success() => {
            let value = String::from_utf8_lossy(&out.stdout).trim().to_string();
            if !value.is_empty() {
                paths.push(PathBuf::from(value));
            }
        }
        Ok(out) => {
            warnings.push(format!(
                "`pnpm store path` exited with status {}",
                out.status
            ));
        }
        Err(_) => {
            // pnpm not installed — fall back to default locations only.
        }
    }

    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(local).join("pnpm").join("store"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = user_home() {
            paths.push(home.join("Library").join("pnpm").join("store"));
        }
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        if let Some(home) = user_home() {
            paths.push(home.join(".local").join("share").join("pnpm").join("store"));
        }
    }

    paths
}

fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    for path in paths {
        let key = path
            .canonicalize()
            .unwrap_or(path.clone())
            .to_string_lossy()
            .to_lowercase();
        if seen.insert(key) {
            out.push(path);
        }
    }
    out
}

pub fn discover_npm_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![];
    for path in dedupe_paths(npm_cache_candidate_paths()) {
        if is_npm_cache_root(&path) {
            push_global_cache(&mut targets, path, Kind::NpmGlobalCache);
        }
    }
    (targets, warnings)
}

pub fn discover_pnpm_global_store() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let mut warnings = vec![];
    for path in dedupe_paths(pnpm_store_candidate_paths(&mut warnings)) {
        if is_pnpm_store_root(&path) {
            push_global_cache(&mut targets, path, Kind::PnpmGlobalStore);
        }
    }
    (targets, warnings)
}

fn push_dir_target(targets: &mut Vec<DiscoveredTarget>, path: PathBuf, kind: Kind) {
    push_global_cache(targets, path, kind);
}

pub fn discover_jvm_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let mut warnings = vec![];
    let Some(home) = user_home() else {
        warnings.push("Could not resolve user home for JVM global cache discovery.".to_string());
        return (targets, warnings);
    };

    push_dir_target(&mut targets, home.join(".m2").join("repository"), Kind::JvmGlobalCache);
    push_dir_target(&mut targets, home.join(".gradle").join("caches"), Kind::JvmGlobalCache);

    (targets, warnings)
}

pub fn discover_ide_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![];

    #[cfg(target_os = "macos")]
    {
        let Some(home) = user_home() else {
            return (
                targets,
                vec!["Could not resolve user home for IDE global cache discovery.".to_string()],
            );
        };
        push_ide_target(
            &mut targets,
            home.join("Library")
                .join("Developer")
                .join("Xcode")
                .join("DerivedData"),
        );
    }

    #[cfg(windows)]
    {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            push_ide_target(
                &mut targets,
                PathBuf::from(local)
                    .join("Xcode")
                    .join("DerivedData"),
            );
        }
    }

    (targets, warnings)
}

fn push_ide_target(targets: &mut Vec<DiscoveredTarget>, path: PathBuf) {
    push_dir_target(targets, path, Kind::IdeGlobalCache);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::create_dir_all;
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_root(prefix: &str) -> PathBuf {
        let base = std::env::temp_dir().join("deco-ecosystem-tests");
        let _ = create_dir_all(&base);
        let root = base.join(format!("{prefix}-{}", Uuid::new_v4()));
        create_dir_all(&root).expect("create temp root");
        root
    }

    #[test]
    fn npm_cache_requires_cacache_marker() {
        let root = temp_root("npm");
        let cache = root.join("npm-cache");
        create_dir_all(cache.join("_cacache")).expect("cacache");
        assert!(is_npm_cache_root(&cache));
        assert!(!is_npm_cache_root(&root));
    }

    #[test]
    fn pnpm_store_requires_v3_marker() {
        let root = temp_root("pnpm");
        let store = root.join("store");
        create_dir_all(store.join("v3")).expect("v3");
        assert!(is_pnpm_store_root(&store));
        assert!(!is_pnpm_store_root(&root));
    }
}
