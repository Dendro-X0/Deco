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

pub(crate) fn is_pnpm_store_root(path: &Path) -> bool {
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

fn command_stdout_path(bin: &str, args: &[&str]) -> Option<PathBuf> {
    let out = Command::new(bin).args(args).output().ok()?;
    if !out.status.success() {
        return None;
    }
    let value = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if value.is_empty() {
        None
    } else {
        Some(PathBuf::from(value))
    }
}

fn is_yarn_cache_root(path: &Path) -> bool {
    path.is_dir()
        && (path.join("v6").is_dir() || path.join("berry").join("cache").is_dir())
}

fn is_pip_cache_root(path: &Path) -> bool {
    path.is_dir() && (path.join("wheels").is_dir() || path.join("http").is_dir())
}

fn is_uv_cache_root(path: &Path) -> bool {
    path.is_dir()
        && (path.join("archive-v0").is_dir() || path.join("downloads-v0").is_dir())
}

fn yarn_cache_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(v) = std::env::var("YARN_CACHE_FOLDER") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }
    if let Some(p) = command_stdout_path("yarn", &["cache", "dir"]) {
        paths.push(p);
    }
    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(local).join("Yarn").join("Cache"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = user_home() {
            paths.push(home.join("Library").join("Caches").join("Yarn"));
        }
    }
    #[cfg(all(not(windows), not(target_os = "macos")))]
    {
        if let Some(home) = user_home() {
            paths.push(home.join(".cache").join("yarn"));
        }
    }
    paths
}

fn pip_cache_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(v) = std::env::var("PIP_CACHE_DIR") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }
    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(local).join("pip").join("Cache"));
        }
    }
    #[cfg(not(windows))]
    {
        if let Some(home) = user_home() {
            paths.push(home.join(".cache").join("pip"));
        }
    }
    paths
}

fn uv_cache_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(v) = std::env::var("UV_CACHE_DIR") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }
    if let Some(p) = command_stdout_path("uv", &["cache", "dir"]) {
        paths.push(p);
    }
    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(local).join("uv").join("cache"));
        }
    }
    #[cfg(not(windows))]
    {
        if let Some(home) = user_home() {
            paths.push(home.join(".cache").join("uv"));
        }
    }
    paths
}

pub fn discover_yarn_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![];
    for path in dedupe_paths(yarn_cache_candidate_paths()) {
        if is_yarn_cache_root(&path) {
            push_global_cache(&mut targets, path, Kind::YarnGlobalCache);
        }
    }
    (targets, warnings)
}

pub fn discover_pip_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![];
    for path in dedupe_paths(pip_cache_candidate_paths()) {
        if is_pip_cache_root(&path) {
            push_global_cache(&mut targets, path, Kind::PipGlobalCache);
        }
    }
    (targets, warnings)
}

pub fn discover_uv_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![];
    for path in dedupe_paths(uv_cache_candidate_paths()) {
        if is_uv_cache_root(&path) {
            push_global_cache(&mut targets, path, Kind::UvGlobalCache);
        }
    }
    (targets, warnings)
}

fn is_conda_envs_path(path: &Path) -> bool {
    let normalized = path.to_string_lossy().replace('\\', "/").to_lowercase();
    normalized.contains("/envs/") || normalized.ends_with("/envs")
}

fn is_conda_pkgs_cache(path: &Path) -> bool {
    if !path.is_dir() || is_conda_envs_path(path) {
        return false;
    }
    path.join("urls.txt").is_file() || path.join("cache").is_dir()
}

fn conda_pkgs_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(v) = std::env::var("CONDA_PKGS_DIRS") {
        for part in v.split(std::path::MAIN_SEPARATOR) {
            let trimmed = part.trim();
            if !trimmed.is_empty() {
                paths.push(PathBuf::from(trimmed));
            }
        }
    }
    if let Some(from_conda) = command_stdout_path("conda", &["info", "--base"]) {
        if let Some(parent) = from_conda.parent() {
            paths.push(parent.join("pkgs"));
        }
    }
    if let Some(home) = user_home() {
        for install_name in [
            "miniconda3",
            "miniforge3",
            "mambaforge",
            "anaconda3",
            "miniconda",
            "anaconda",
        ] {
            paths.push(home.join(install_name).join("pkgs"));
        }
    }
    paths
}

fn cargo_home_dir() -> Option<PathBuf> {
    if let Ok(v) = std::env::var("CARGO_HOME") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            return Some(PathBuf::from(trimmed));
        }
    }
    user_home().map(|h| h.join(".cargo"))
}

fn is_cargo_registry_root(path: &Path) -> bool {
    path.is_dir() && path.join("cache").is_dir()
}

fn bun_cache_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(v) = std::env::var("BUN_INSTALL_CACHE_DIR") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }
    if let Some(home) = user_home() {
        paths.push(home.join(".bun").join("install").join("cache"));
    }
    paths
}

fn is_bun_cache_root(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    std::fs::read_dir(path)
        .ok()
        .and_then(|mut entries| entries.next())
        .is_some()
}

fn nuget_packages_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(v) = std::env::var("NUGET_PACKAGES") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }
    if let Some(home) = user_home() {
        paths.push(home.join(".nuget").join("packages"));
    }
    paths
}

fn is_nuget_packages_root(path: &Path) -> bool {
    if !path.is_dir() {
        return false;
    }
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
    if name != "packages" {
        return false;
    }
    let Ok(mut packages) = std::fs::read_dir(path) else {
        return false;
    };
    let Some(Ok(pkg)) = packages.next() else {
        return false;
    };
    if !pkg.path().is_dir() {
        return false;
    }
    std::fs::read_dir(pkg.path())
        .ok()
        .and_then(|mut vers| vers.next())
        .and_then(|e| e.ok())
        .map(|v| v.path().is_dir())
        .unwrap_or(false)
}

pub fn discover_cargo_registry_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![];
    if let Some(home) = cargo_home_dir() {
        let registry = home.join("registry");
        if is_cargo_registry_root(&registry) {
            push_global_cache(&mut targets, registry, Kind::CargoRegistryCache);
        }
    }
    (targets, warnings)
}

pub fn discover_bun_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![];
    for path in dedupe_paths(bun_cache_candidate_paths()) {
        if is_bun_cache_root(&path) {
            push_global_cache(&mut targets, path, Kind::BunGlobalCache);
        }
    }
    (targets, warnings)
}

fn composer_cache_candidate_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    if let Ok(v) = std::env::var("COMPOSER_CACHE_DIR") {
        let trimmed = v.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed));
        }
    }
    if let Ok(home) = std::env::var("COMPOSER_HOME") {
        let trimmed = home.trim();
        if !trimmed.is_empty() {
            paths.push(PathBuf::from(trimmed).join("cache"));
        }
    }
    if let Some(home) = user_home() {
        paths.push(home.join(".composer").join("cache"));
        #[cfg(not(windows))]
        {
            paths.push(home.join(".cache").join("composer"));
        }
    }
    #[cfg(windows)]
    {
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            paths.push(PathBuf::from(local).join("Composer").join("cache"));
        }
    }
    paths
}

fn is_composer_cache_root(path: &Path) -> bool {
    path.is_dir() && (path.join("files").is_dir() || path.join("repo").is_dir())
}

pub fn discover_composer_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![];
    for path in dedupe_paths(composer_cache_candidate_paths()) {
        if is_composer_cache_root(&path) {
            push_global_cache(&mut targets, path, Kind::ComposerGlobalCache);
        }
    }
    (targets, warnings)
}

pub fn discover_nuget_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![];
    for path in dedupe_paths(nuget_packages_candidate_paths()) {
        if is_nuget_packages_root(&path) {
            push_global_cache(&mut targets, path, Kind::NugetGlobalCache);
        }
    }
    (targets, warnings)
}

pub fn discover_conda_pkgs_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let warnings = vec![
        "Conda envs/ directories are never targeted; only package caches (pkgs) with markers."
            .to_string(),
    ];
    for path in dedupe_paths(conda_pkgs_candidate_paths()) {
        if is_conda_pkgs_cache(&path) {
            push_global_cache(&mut targets, path, Kind::CondaPkgsCache);
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

    #[test]
    fn yarn_cache_accepts_classic_or_berry_markers() {
        let root = temp_root("yarn");
        let classic = root.join("classic");
        create_dir_all(classic.join("v6")).expect("v6");
        assert!(is_yarn_cache_root(&classic));
        let berry = root.join("berry-root");
        create_dir_all(berry.join("berry").join("cache")).expect("berry cache");
        assert!(is_yarn_cache_root(&berry));
    }

    #[test]
    fn pip_cache_requires_wheels_or_http() {
        let root = temp_root("pip");
        let cache = root.join("pip-cache");
        create_dir_all(cache.join("wheels")).expect("wheels");
        assert!(is_pip_cache_root(&cache));
    }

    #[test]
    fn uv_cache_requires_archive_or_downloads() {
        let root = temp_root("uv");
        let cache = root.join("uv-cache");
        create_dir_all(cache.join("downloads-v0")).expect("downloads");
        assert!(is_uv_cache_root(&cache));
    }

    #[test]
    fn conda_pkgs_requires_urls_or_cache_subdir() {
        let root = temp_root("conda");
        let pkgs = root.join("pkgs");
        create_dir_all(&pkgs).expect("pkgs dir");
        std::fs::write(pkgs.join("urls.txt"), "https://example.invalid\n").expect("urls");
        assert!(is_conda_pkgs_cache(&pkgs));
        assert!(!is_conda_pkgs_cache(&root.join("envs")));
    }

    #[test]
    fn cargo_registry_requires_cache_subdir() {
        let root = temp_root("cargo");
        let registry = root.join("registry");
        create_dir_all(registry.join("cache")).expect("cache");
        assert!(is_cargo_registry_root(&registry));
    }

    #[test]
    fn bun_cache_requires_content() {
        let root = temp_root("bun");
        let cache = root.join("bun-cache");
        create_dir_all(cache.join("abc123")).expect("entry");
        assert!(is_bun_cache_root(&cache));
    }

    #[test]
    fn composer_cache_requires_files_or_repo() {
        let root = temp_root("composer");
        let cache = root.join("composer-cache");
        create_dir_all(cache.join("files")).expect("files");
        assert!(is_composer_cache_root(&cache));
        assert!(!is_composer_cache_root(&root));
    }

    #[test]
    fn nuget_packages_requires_version_folder() {
        let root = temp_root("nuget");
        let packages = root.join("packages");
        create_dir_all(packages.join("Newtonsoft.Json").join("13.0.3")).expect("pkg");
        assert!(is_nuget_packages_root(&packages));
    }
}
