use super::path_policy::PathPolicy;
use super::project_detection::detect_project_root;
use super::regeneration_hints::display_with_regeneration_hint;
use super::scanner::DiscoveredTarget;
use super::types::{CleanupCandidate, Kind, RiskLevel, SafetyClass};
use std::path::Path;
use uuid::Uuid;

pub fn classify_targets(
    discovered: Vec<DiscoveredTarget>,
    roots: &[String],
    stale_days_threshold: u32,
    policy: &PathPolicy,
) -> Vec<CleanupCandidate> {
    let now_ms = chrono::Utc::now().timestamp_millis();

    discovered
        .into_iter()
        .map(|target| {
            if matches!(
                target.kind,
                Kind::GoGlobalCache
                    | Kind::JvmGlobalCache
                    | Kind::IdeGlobalCache
                    | Kind::NpmGlobalCache
                    | Kind::PnpmGlobalStore
                    | Kind::YarnGlobalCache
                    | Kind::PipGlobalCache
                    | Kind::UvGlobalCache
                    | Kind::CondaPkgsCache
                    | Kind::CargoRegistryCache
                    | Kind::BunGlobalCache
                    | Kind::NugetGlobalCache
                    | Kind::ComposerGlobalCache
            ) {
                let mut reason_codes = vec![
                    "GLOBAL_CACHE_TARGET".to_string(),
                    "GLOBAL_CACHE_REQUIRES_OPT_IN".to_string(),
                ];
                if target.kind == Kind::CondaPkgsCache {
                    reason_codes.push("CONDA_PKGS_CACHE_ONLY".to_string());
                }
                let display_summary =
                    display_with_regeneration_hint(&target.kind, &reason_codes);
                return CleanupCandidate {
                    id: Uuid::new_v4().to_string(),
                    kind: target.kind,
                    abs_path: target.abs_path,
                    size_bytes: None,
                    mtime_ms: target.mtime_ms,
                    risk: RiskLevel::Review,
                    safety_class: SafetyClass::GlobalCache,
                    display_reason_summary: Some(display_summary),
                    can_delete: true,
                    reason_codes,
                    project_root: None,
                    stale_days: None,
                };
            }

            if let Some(path_match) = policy.find_match(&target.abs_path) {
                let reason_codes = path_match.reason_codes;
                return CleanupCandidate {
                    id: Uuid::new_v4().to_string(),
                    kind: target.kind,
                    abs_path: target.abs_path,
                    size_bytes: None,
                    mtime_ms: target.mtime_ms,
                    risk: path_match.risk,
                    safety_class: path_match.safety_class,
                    display_reason_summary: Some(reason_summary(&reason_codes)),
                    can_delete: false,
                    reason_codes,
                    project_root: None,
                    stale_days: None,
                };
            }

            if target.kind == Kind::PythonVenv {
                let reason_codes = vec![
                    "PYTHON_VENV_HIGH_RISK".to_string(),
                    "PYTHON_VENV_REQUIRES_OPT_IN".to_string(),
                ];
                return CleanupCandidate {
                    id: Uuid::new_v4().to_string(),
                    kind: target.kind,
                    abs_path: target.abs_path,
                    size_bytes: None,
                    mtime_ms: target.mtime_ms,
                    risk: RiskLevel::Review,
                    safety_class: SafetyClass::Unknown,
                    display_reason_summary: Some(reason_summary(&reason_codes)),
                    can_delete: true,
                    reason_codes,
                    project_root: None,
                    stale_days: None,
                };
            }

            let containing_root = find_containing_root(&target.abs_path, roots);
            let start_dir = Path::new(&target.abs_path)
                .parent()
                .unwrap_or_else(|| Path::new(&target.abs_path));
            let evidence =
                detect_project_root(start_dir, 4, containing_root.as_ref().map(Path::new));

            if target.kind == Kind::NodeModules {
                if evidence.is_none() {
                    let reason_codes = vec![
                        "NODE_MODULES_OUTSIDE_PROJECT".to_string(),
                        "PROJECT_MARKERS_MISSING".to_string(),
                    ];
                    return CleanupCandidate {
                        id: Uuid::new_v4().to_string(),
                        kind: target.kind,
                        abs_path: target.abs_path,
                        size_bytes: None,
                        mtime_ms: target.mtime_ms,
                        risk: RiskLevel::Blocked,
                        safety_class: SafetyClass::Unknown,
                        display_reason_summary: Some(reason_summary(&reason_codes)),
                        can_delete: false,
                        reason_codes,
                        project_root: None,
                        stale_days: None,
                    };
                }

                let stale_days = target
                    .mtime_ms
                    .map(|mtime| ((now_ms - mtime) / (1000 * 60 * 60 * 24)).max(0) as u32);

                let (risk, reason) = match stale_days {
                    Some(days) if days >= stale_days_threshold => {
                        (RiskLevel::Safe, "NODE_MODULES_STALE")
                    }
                    Some(_) => (RiskLevel::Review, "NODE_MODULES_NOT_STALE"),
                    None => (RiskLevel::Review, "LOW_CONFIDENCE_ARTIFACT"),
                };
                let can_delete = risk != RiskLevel::Blocked;

                let reason_codes = vec!["PROJECT_MARKERS_PRESENT".to_string(), reason.to_string()];
                return CleanupCandidate {
                    id: Uuid::new_v4().to_string(),
                    kind: target.kind,
                    abs_path: target.abs_path,
                    size_bytes: None,
                    mtime_ms: target.mtime_ms,
                    risk,
                    safety_class: SafetyClass::ProjectArtifact,
                    display_reason_summary: Some(reason_summary(&reason_codes)),
                    can_delete,
                    reason_codes,
                    project_root: evidence.map(|ev| ev.project_root),
                    stale_days,
                };
            }

            if let Some(ev) = evidence {
                let reason_codes = vec!["PROJECT_MARKERS_PRESENT".to_string()];
                CleanupCandidate {
                    id: Uuid::new_v4().to_string(),
                    kind: target.kind,
                    abs_path: target.abs_path,
                    size_bytes: None,
                    mtime_ms: target.mtime_ms,
                    risk: RiskLevel::Safe,
                    safety_class: SafetyClass::ProjectArtifact,
                    display_reason_summary: Some(reason_summary(&reason_codes)),
                    can_delete: true,
                    reason_codes,
                    project_root: Some(ev.project_root),
                    stale_days: None,
                }
            } else {
                let reason_codes = vec![
                    "PROJECT_MARKERS_MISSING".to_string(),
                    "LOW_CONFIDENCE_ARTIFACT".to_string(),
                ];
                CleanupCandidate {
                    id: Uuid::new_v4().to_string(),
                    kind: target.kind,
                    abs_path: target.abs_path,
                    size_bytes: None,
                    mtime_ms: target.mtime_ms,
                    risk: RiskLevel::Review,
                    safety_class: SafetyClass::Unknown,
                    display_reason_summary: Some(reason_summary(&reason_codes)),
                    can_delete: true,
                    reason_codes,
                    project_root: None,
                    stale_days: None,
                }
            }
        })
        .collect()
}

fn reason_summary(reasons: &[String]) -> String {
    if reasons.is_empty() {
        return "Unspecified".to_string();
    }
    reasons
        .iter()
        .map(|code| code.to_lowercase().replace('_', " "))
        .collect::<Vec<String>>()
        .join(", ")
}

fn find_containing_root(abs_path: &str, roots: &[String]) -> Option<String> {
    let normalized = abs_path.to_lowercase();
    roots
        .iter()
        .filter(|root| {
            let r = root.to_lowercase();
            normalized == r || normalized.starts_with(&(r + &std::path::MAIN_SEPARATOR.to_string()))
        })
        .max_by_key(|root| root.len())
        .cloned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::scanner::DiscoveredTarget;
    use std::fs::{create_dir_all, remove_dir_all, write};
    use std::path::PathBuf;
    use uuid::Uuid;

    fn temp_root(prefix: &str) -> PathBuf {
        let base = std::env::current_dir()
            .expect("cwd")
            .join("..")
            .join(".tmp-rust-tests");
        create_dir_all(&base).expect("create base");
        let root = base.join(format!("deco-rust-{prefix}-{}", Uuid::new_v4()));
        create_dir_all(&root).expect("create temp root");
        root
    }

    #[test]
    fn marks_stale_project_node_modules_as_safe() {
        let root = temp_root("class-safe");
        write(root.join("package.json"), "{}").expect("write package");
        write(root.join("pnpm-lock.yaml"), "lockfileVersion: 9").expect("write lock");
        create_dir_all(root.join("node_modules")).expect("create nm");

        let stale_ms = chrono::Utc::now().timestamp_millis() - 80 * 24 * 60 * 60 * 1000;
        let discovered = vec![DiscoveredTarget {
            kind: Kind::NodeModules,
            abs_path: root.join("node_modules").to_string_lossy().to_string(),
            mtime_ms: Some(stale_ms),
        }];

        let policy = PathPolicy::new(vec![], vec![]);
        let roots = vec![root.to_string_lossy().to_string()];
        let classified = classify_targets(discovered, &roots, 45, &policy);
        assert_eq!(classified[0].risk, RiskLevel::Safe);
        assert!(classified[0]
            .reason_codes
            .contains(&"NODE_MODULES_STALE".to_string()));

        remove_dir_all(root).expect("cleanup");
    }

    #[test]
    fn blocks_node_modules_outside_project() {
        let root = temp_root("class-blocked");
        create_dir_all(root.join("node_modules")).expect("create nm");

        let discovered = vec![DiscoveredTarget {
            kind: Kind::NodeModules,
            abs_path: root.join("node_modules").to_string_lossy().to_string(),
            mtime_ms: Some(chrono::Utc::now().timestamp_millis()),
        }];

        let policy = PathPolicy::new(vec![], vec![]);
        let roots = vec![root.to_string_lossy().to_string()];
        let classified = classify_targets(discovered, &roots, 45, &policy);
        assert_eq!(classified[0].risk, RiskLevel::Blocked);
        assert!(classified[0]
            .reason_codes
            .contains(&"NODE_MODULES_OUTSIDE_PROJECT".to_string()));

        remove_dir_all(root).expect("cleanup");
    }
}
