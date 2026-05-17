use std::collections::HashMap;
use std::path::Path;

use super::project_detection::{detect_project_root, ProjectEvidence};

/// Memoizes [`detect_project_root`] during a single scan (classify phase).
#[derive(Debug, Default)]
pub struct ProjectRootCache {
    evidence: HashMap<String, Option<ProjectEvidence>>,
}

fn cache_key(start_dir: &Path, stop_at: Option<&Path>) -> String {
    let start = start_dir.to_string_lossy();
    let stop = stop_at
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    #[cfg(windows)]
    {
        format!("{}|{}", start.to_lowercase(), stop.to_lowercase())
    }
    #[cfg(not(windows))]
    {
        format!("{start}|{stop}")
    }
}

impl ProjectRootCache {
    pub fn detect(
        &mut self,
        start_dir: &Path,
        max_ascend: u32,
        stop_at: Option<&Path>,
    ) -> Option<ProjectEvidence> {
        let key = cache_key(start_dir, stop_at);
        if let Some(hit) = self.evidence.get(&key) {
            return hit.clone();
        }
        let value = detect_project_root(start_dir, max_ascend, stop_at);
        self.evidence.insert(key, value.clone());
        value
    }
}
