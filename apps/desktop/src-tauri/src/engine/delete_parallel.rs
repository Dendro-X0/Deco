//! Parallel in-place deletes for independent directory trees (v0.6.5).

use super::types::Kind;
use crate::engine::scan_concurrency::scan_worker_count;
use std::path::Path;

/// Max concurrent tree deletes; follows scan performance preset (`auto` ≈ 6, `high` = 8).
/// Large batches on HDD thrash when too parallel — cap workers.
pub fn delete_parallelism_from_scan_mode(mode: &str, item_count: usize) -> usize {
    let base = scan_worker_count(mode);
    if item_count > 2_000 {
        1
    } else if item_count > 400 {
        base.min(2)
    } else {
        base
    }
}

/// Large artifact folders that benefit from bulk OS delete + parallel workers.
pub fn is_bulk_tree_delete(path: &Path, kind: &Kind) -> bool {
    match kind {
        Kind::NodeModules | Kind::RustArtifact | Kind::BuildArtifact => return true,
        _ => {}
    }
    path.file_name()
        .and_then(|n| n.to_str())
        .map(|name| bulk_tree_dir_name(name))
        .unwrap_or(false)
        || path.components().any(|c| {
            c.as_os_str()
                .to_str()
                .map(bulk_tree_dir_name)
                .unwrap_or(false)
        })
}

fn bulk_tree_dir_name(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        "node_modules"
            | "target"
            | ".cargo-target"
            | "dist"
            | "build"
            | ".next"
            | ".nuxt"
            | ".turbo"
            | ".gradle"
            | "__pycache__"
            | ".pytest_cache"
            | ".venv"
            | "venv"
            | ".parcel-cache"
            | ".svelte-kit"
            | "out"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn bulk_tree_includes_rust_target() {
        assert!(is_bulk_tree_delete(
            Path::new(r"G:\proj\crate\target"),
            &Kind::RustArtifact
        ));
    }

    #[test]
    fn delete_parallelism_auto_is_six() {
        assert_eq!(delete_parallelism_from_scan_mode("auto", 10), 6);
    }

    #[test]
    fn delete_parallelism_low_is_conservative() {
        assert_eq!(delete_parallelism_from_scan_mode("low", 10), 2);
    }

    #[test]
    fn delete_parallelism_capped_for_huge_batches() {
        assert_eq!(delete_parallelism_from_scan_mode("high", 3000), 1);
    }
}
