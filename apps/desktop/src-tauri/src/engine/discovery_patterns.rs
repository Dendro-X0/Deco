//! Declarative walk-time patterns (L2 discovery). See docs/experiments/smart-scan-strategy.md.

use super::ecosystem_globals::is_pnpm_store_root;
use super::types::{EcosystemScanOptions, Kind};
use std::path::Path;

#[derive(Clone, Copy)]
enum PatternOptIn {
    IdeGlobalCache,
    PnpmGlobalStore,
}

struct WalkPattern {
    /// Stable id for tests and future diagnostics (`pattern_ids_are_unique`).
    #[allow(dead_code)]
    id: &'static str,
    dir_name: &'static str,
    /// When set, full path must contain this substring (case-insensitive).
    path_contains: Option<&'static str>,
    opt_in: PatternOptIn,
    kind: Kind,
}

const PATTERNS: &[WalkPattern] = &[
    WalkPattern {
        id: "android_studio_caches",
        dir_name: "caches",
        path_contains: Some("androidstudio"),
        opt_in: PatternOptIn::IdeGlobalCache,
        kind: Kind::IdeGlobalCache,
    },
    WalkPattern {
        id: "jetbrains_ide_caches",
        dir_name: "caches",
        path_contains: Some("jetbrains"),
        opt_in: PatternOptIn::IdeGlobalCache,
        kind: Kind::IdeGlobalCache,
    },
    WalkPattern {
        id: "pnpm_store_walk",
        dir_name: ".pnpm-store",
        path_contains: None,
        opt_in: PatternOptIn::PnpmGlobalStore,
        kind: Kind::PnpmGlobalStore,
    },
];

fn opt_in_enabled(opt_in: PatternOptIn, eco: EcosystemScanOptions) -> bool {
    match opt_in {
        PatternOptIn::IdeGlobalCache => eco.check_ide_global_cache,
        PatternOptIn::PnpmGlobalStore => eco.check_pnpm_store,
    }
}

/// Match L2 patterns when smart discovery is enabled. Never returns a kind the user has not opted into.
pub fn match_walk_pattern(
    entry_path: &Path,
    dir_name: &str,
    eco: EcosystemScanOptions,
    smart_discovery: bool,
) -> Option<Kind> {
    if !smart_discovery {
        return None;
    }
    let path_lower = entry_path.to_string_lossy().to_lowercase();
    for pattern in PATTERNS {
        if dir_name != pattern.dir_name {
            continue;
        }
        if let Some(needle) = pattern.path_contains {
            if !path_lower.contains(needle) {
                continue;
            }
        }
        if !opt_in_enabled(pattern.opt_in, eco) {
            continue;
        }
        if pattern.kind == Kind::PnpmGlobalStore && !is_pnpm_store_root(entry_path) {
            continue;
        }
        return Some(pattern.kind);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;
    use std::fs::create_dir_all;
    use std::path::PathBuf;

    fn eco(ide: bool, pnpm: bool) -> EcosystemScanOptions {
        EcosystemScanOptions {
            check_ide_global_cache: ide,
            check_pnpm_store: pnpm,
            ..EcosystemScanOptions::default()
        }
    }

    #[test]
    fn pattern_ids_are_unique() {
        let ids: HashSet<_> = PATTERNS.iter().map(|p| p.id).collect();
        assert_eq!(ids.len(), PATTERNS.len());
    }

    #[test]
    fn android_studio_caches_requires_opt_in() {
        let path = PathBuf::from(r"C:\Users\me\AppData\Local\Google\AndroidStudio2024.1\caches");
        assert!(match_walk_pattern(&path, "caches", eco(false, false), true).is_none());
        assert_eq!(
            match_walk_pattern(&path, "caches", eco(true, false), true),
            Some(Kind::IdeGlobalCache)
        );
    }

    #[test]
    fn jetbrains_caches_match() {
        let path = PathBuf::from(r"C:\Users\me\AppData\Local\JetBrains\IntelliJIdea2024.1\caches");
        assert_eq!(
            match_walk_pattern(&path, "caches", eco(true, false), true),
            Some(Kind::IdeGlobalCache)
        );
    }

    #[test]
    fn pnpm_store_requires_v3_and_opt_in() {
        let root = std::env::temp_dir().join(format!("deco-pnpm-{}", uuid::Uuid::new_v4()));
        let store = root.join(".pnpm-store");
        create_dir_all(store.join("v3")).expect("v3");
        assert!(match_walk_pattern(&store, ".pnpm-store", eco(false, false), true).is_none());
        assert!(match_walk_pattern(&store, ".pnpm-store", eco(false, true), false).is_none());
        assert_eq!(
            match_walk_pattern(&store, ".pnpm-store", eco(false, true), true),
            Some(Kind::PnpmGlobalStore)
        );
        let _ = std::fs::remove_dir_all(root);
    }

    #[test]
    fn smart_off_never_matches() {
        let path = PathBuf::from(r"C:\Users\me\AppData\Local\Google\AndroidStudio2024.1\caches");
        assert!(match_walk_pattern(&path, "caches", eco(true, false), false).is_none());
    }
}
