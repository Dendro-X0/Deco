use super::scanner::DiscoveredTarget;
use super::types::Kind;
use std::path::PathBuf;

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

fn push_dir_target(targets: &mut Vec<DiscoveredTarget>, path: PathBuf) {
    if !path.is_dir() {
        return;
    }
    let mtime_ms = std::fs::metadata(&path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64);
    targets.push(DiscoveredTarget {
        kind: Kind::JvmGlobalCache,
        abs_path: path.to_string_lossy().to_string(),
        mtime_ms,
    });
}

pub fn discover_jvm_global_caches() -> (Vec<DiscoveredTarget>, Vec<String>) {
    let mut targets = vec![];
    let mut warnings = vec![];
    let Some(home) = user_home() else {
        warnings.push("Could not resolve user home for JVM global cache discovery.".to_string());
        return (targets, warnings);
    };

    push_dir_target(&mut targets, home.join(".m2").join("repository"));
    push_dir_target(&mut targets, home.join(".gradle").join("caches"));

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
    if !path.is_dir() {
        return;
    }
    let mtime_ms = std::fs::metadata(&path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64);
    targets.push(DiscoveredTarget {
        kind: Kind::IdeGlobalCache,
        abs_path: path.to_string_lossy().to_string(),
        mtime_ms,
    });
}
