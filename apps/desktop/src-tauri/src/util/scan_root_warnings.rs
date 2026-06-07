//! Warn when scan roots overlap global toolchain caches (v0.9.10).

use serde::Serialize;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ScanRootWarning {
    pub id: &'static str,
    pub path: String,
}

fn norm_path(path: &str) -> String {
    path.replace('/', "\\").trim().trim_end_matches('\\').to_lowercase()
}

fn path_matches_pattern(normalized: &str, pattern: &ScanRootPattern) -> bool {
    match pattern.match_kind {
        ScanRootMatchKind::EndsWith(suffix) => {
            normalized == suffix || normalized.ends_with(&format!("\\{suffix}"))
        }
        ScanRootMatchKind::Contains(part) => normalized.contains(part),
    }
}

enum ScanRootMatchKind {
    EndsWith(&'static str),
    Contains(&'static str),
}

struct ScanRootPattern {
    id: &'static str,
    match_kind: ScanRootMatchKind,
}

const PATTERNS: &[ScanRootPattern] = &[
    ScanRootPattern {
        id: "cargo_home",
        match_kind: ScanRootMatchKind::EndsWith(".cargo"),
    },
    ScanRootPattern {
        id: "rustup_home",
        match_kind: ScanRootMatchKind::EndsWith(".rustup"),
    },
    ScanRootPattern {
        id: "npm_cache",
        match_kind: ScanRootMatchKind::Contains("\\appdata\\local\\npm-cache"),
    },
    ScanRootPattern {
        id: "pnpm_store",
        match_kind: ScanRootMatchKind::Contains("\\appdata\\local\\pnpm"),
    },
    ScanRootPattern {
        id: "yarn_cache",
        match_kind: ScanRootMatchKind::Contains("\\appdata\\local\\yarn"),
    },
    ScanRootPattern {
        id: "go_mod_cache",
        match_kind: ScanRootMatchKind::Contains("\\go\\pkg\\mod"),
    },
    ScanRootPattern {
        id: "go_build_cache",
        match_kind: ScanRootMatchKind::EndsWith("\\go-build"),
    },
];

/// Returns a warning id when `path` looks like a global toolchain cache root.
pub fn scan_root_warning(path: &Path) -> Option<ScanRootWarning> {
    let display = path.to_string_lossy().to_string();
    if display.trim().is_empty() {
        return None;
    }
    let normalized = norm_path(&display);
    for pattern in PATTERNS {
        if path_matches_pattern(&normalized, pattern) {
            return Some(ScanRootWarning {
                id: pattern.id,
                path: display,
            });
        }
    }
    None
}

pub fn scan_roots_warnings(paths: &[String]) -> Vec<ScanRootWarning> {
    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for p in paths {
        if let Some(w) = scan_root_warning(Path::new(p)) {
            let key = format!("{}:{}", w.id, w.path.to_lowercase());
            if seen.insert(key) {
                out.push(w);
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn warns_cargo_home() {
        let w = scan_root_warning(Path::new(r"C:\Users\me\.cargo")).expect("warn");
        assert_eq!(w.id, "cargo_home");
    }

    #[test]
    fn warns_npm_cache() {
        let w = scan_root_warning(Path::new(
            r"C:\Users\me\AppData\Local\npm-cache",
        ))
        .expect("warn");
        assert_eq!(w.id, "npm_cache");
    }

    #[test]
    fn allows_project_root() {
        assert!(scan_root_warning(Path::new(r"E:\repos\my-app")).is_none());
    }
}
