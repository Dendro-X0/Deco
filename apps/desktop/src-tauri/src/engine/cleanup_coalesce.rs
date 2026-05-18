//! Merge cleanup targets so parent tree deletes subsume children (fewer HDD round-trips).

use super::types::CleanupCandidate;
use std::collections::HashSet;
use std::path::{Path, MAIN_SEPARATOR, MAIN_SEPARATOR_STR};

/// Drop dominated paths, then exact-path duplicates.
pub fn coalesce_for_delete(candidates: Vec<CleanupCandidate>) -> (Vec<CleanupCandidate>, u32) {
    let (c, d1) = coalesce_dominated_paths(candidates);
    let (c, d2) = dedupe_paths(c);
    (c, d1 + d2)
}

/// Drop candidates whose path lies under another candidate in the same batch.
fn coalesce_dominated_paths(mut candidates: Vec<CleanupCandidate>) -> (Vec<CleanupCandidate>, u32) {
    if candidates.len() < 2 {
        return (candidates, 0);
    }
    candidates.sort_by_key(|c| c.abs_path.len());
    let mut kept: Vec<CleanupCandidate> = Vec::with_capacity(candidates.len());
    let mut dropped = 0u32;
    for c in candidates {
        if kept
            .iter()
            .any(|k| path_is_strict_ancestor(&k.abs_path, &c.abs_path))
        {
            dropped += 1;
            continue;
        }
        kept.push(c);
    }
    (kept, dropped)
}

fn dedupe_paths(candidates: Vec<CleanupCandidate>) -> (Vec<CleanupCandidate>, u32) {
    let mut seen = HashSet::new();
    let mut out = Vec::with_capacity(candidates.len());
    let mut dropped = 0u32;
    for c in candidates {
        let key = normalize_path_key(&c.abs_path);
        if seen.insert(key) {
            out.push(c);
        } else {
            dropped += 1;
        }
    }
    (out, dropped)
}

fn normalize_separators(path: &str) -> String {
    path.replace('\\', MAIN_SEPARATOR_STR)
        .replace('/', MAIN_SEPARATOR_STR)
}

fn normalize_path_key(path: &str) -> String {
    normalize_separators(&Path::new(path).to_string_lossy()).to_ascii_lowercase()
}

fn path_is_strict_ancestor(ancestor: &str, child: &str) -> bool {
    let a = normalize_dir_prefix(ancestor);
    let c = normalize_dir_prefix(child);
    !a.is_empty() && c.len() > a.len() && c.starts_with(&a)
}

fn normalize_dir_prefix(path: &str) -> String {
    let s = normalize_separators(path);
    if s.ends_with(MAIN_SEPARATOR) {
        s
    } else {
        format!("{s}{MAIN_SEPARATOR}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::types::{Kind, RiskLevel, SafetyClass};

    fn nm(path: &str) -> CleanupCandidate {
        CleanupCandidate {
            id: path.to_string(),
            kind: Kind::NodeModules,
            abs_path: path.to_string(),
            size_bytes: Some(1),
            mtime_ms: None,
            risk: RiskLevel::Safe,
            safety_class: SafetyClass::ProjectArtifact,
            reason_codes: vec![],
            display_reason_summary: None,
            can_delete: true,
            project_root: None,
            stale_days: None,
        }
    }

    #[test]
    fn drops_child_under_parent_target() {
        let parent = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("target")
            .join("coalesce-test-proj");
        let nm_path = parent.join("node_modules");
        let child_path = nm_path.join(".cache").join("foo");
        let (out, dropped) = coalesce_for_delete(vec![
            nm(&nm_path.to_string_lossy()),
            nm(&child_path.to_string_lossy()),
        ]);
        assert_eq!(dropped, 1);
        assert_eq!(out.len(), 1);
        assert!(
            out[0]
                .abs_path
                .replace('\\', "/")
                .ends_with("node_modules")
        );
    }
}
