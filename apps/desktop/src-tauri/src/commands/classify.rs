use crate::engine::classifier::classify_targets;
use crate::engine::path_policy::PathPolicy;
use crate::engine::scanner::DiscoveredTarget;
use crate::engine::types::CleanupCandidate;

#[tauri::command]
pub fn classify_targets_preview(
    roots: Vec<String>,
    stale_days: u32,
    discovered: Vec<DiscoveredTarget>,
    extra_protected_path_contains: Vec<String>,
    allow_path_contains: Vec<String>,
) -> Result<Vec<CleanupCandidate>, String> {
    let policy = PathPolicy::new(extra_protected_path_contains, allow_path_contains);
    Ok(classify_targets(
        discovered,
        &roots,
        stale_days,
        &policy,
        crate::engine::classifier::DEFAULT_CLASSIFY_PARALLEL_THRESHOLD,
    ))
}
