//! Validate `.deco/disk-cleanup.json` policy packs (same rules as CLI `policy-validate.ts`).

use serde_json::Value;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct ValidatedPolicySummary {
    pub config_path: PathBuf,
    pub profile: Option<String>,
    pub roots_count: usize,
    pub excludes_count: usize,
    pub extra_protected_count: usize,
    pub allow_paths_count: usize,
}

#[derive(Debug)]
pub enum PolicyValidateError {
    PathNotFound(String),
    NotFileOrDir(String),
    NoConfigFound(String),
    InvalidJson { path: PathBuf, detail: String },
    Validation(String),
}

impl PolicyValidateError {
    pub fn message(&self) -> String {
        match self {
            Self::PathNotFound(p) => format!("Path not found: {p}"),
            Self::NotFileOrDir(p) => format!("Not a file or directory: {p}"),
            Self::NoConfigFound(p) => format!(
                "No disk-cleanup.json under {p} (expected disk-cleanup.json or .deco/disk-cleanup.json)"
            ),
            Self::InvalidJson { path, detail } => {
                format!("Invalid JSON in {}: {detail}", path.display())
            }
            Self::Validation(msg) => msg.clone(),
        }
    }
}

pub fn resolve_policy_config_path(input: &Path) -> Result<PathBuf, PolicyValidateError> {
    let abs = input
        .canonicalize()
        .map_err(|_| PolicyValidateError::PathNotFound(input.display().to_string()))?;
    if abs.is_file() {
        return Ok(abs);
    }
    if !abs.is_dir() {
        return Err(PolicyValidateError::NotFileOrDir(abs.display().to_string()));
    }
    let candidates = [
        abs.join("disk-cleanup.json"),
        abs.join(".deco").join("disk-cleanup.json"),
    ];
    for candidate in &candidates {
        if candidate.is_file() {
            return Ok(candidate.clone());
        }
    }
    Err(PolicyValidateError::NoConfigFound(abs.display().to_string()))
}

pub fn validate_policy_config_file(config_path: &Path) -> Result<ValidatedPolicySummary, PolicyValidateError> {
    let text = std::fs::read_to_string(config_path).map_err(|e| PolicyValidateError::Validation(format!(
        "failed reading {}: {e}",
        config_path.display()
    )))?;
    let parsed: Value = serde_json::from_str(&text).map_err(|e| PolicyValidateError::InvalidJson {
        path: config_path.to_path_buf(),
        detail: e.to_string(),
    })?;
    validate_config_value(&parsed)?;
    Ok(summarize_policy(config_path, &parsed))
}

pub fn validate_policy_input(input: &Path) -> Result<ValidatedPolicySummary, PolicyValidateError> {
    let config_path = resolve_policy_config_path(input)?;
    validate_policy_config_file(&config_path)
}

fn summarize_policy(config_path: &Path, value: &Value) -> ValidatedPolicySummary {
    let profile = value
        .get("profile")
        .and_then(|v| v.as_str())
        .map(String::from);
    let roots_count = value
        .get("roots")
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0);
    let excludes_count = string_array_len(value.get("excludeAbsPathContains"));
    let extra_protected_count = value
        .get("safety")
        .and_then(|s| s.get("extraProtectedPathContains"))
        .map(|v| string_array_len(Some(v)))
        .unwrap_or(0);
    let allow_paths_count = value
        .get("safety")
        .and_then(|s| s.get("allowPathContains"))
        .map(|v| string_array_len(Some(v)))
        .unwrap_or(0);
    ValidatedPolicySummary {
        config_path: config_path.to_path_buf(),
        profile,
        roots_count,
        excludes_count,
        extra_protected_count,
        allow_paths_count,
    }
}

fn string_array_len(value: Option<&Value>) -> usize {
    value
        .and_then(|v| v.as_array())
        .map(|a| a.len())
        .unwrap_or(0)
}

fn validate_config_value(data: &Value) -> Result<(), PolicyValidateError> {
    let obj = data
        .as_object()
        .ok_or_else(|| PolicyValidateError::Validation("Config must be an object".to_string()))?;
    assert_only_keys(
        obj,
        &[
            "roots",
            "maxDepth",
            "targets",
            "additionalDirNames",
            "excludeAbsPathContains",
            "profile",
            "deleteMode",
            "staleDays",
            "quarantine",
            "safety",
        ],
        "config",
    )?;

    if let Some(roots) = obj.get("roots") {
        if !is_string_array(roots) {
            return Err(PolicyValidateError::Validation(
                "config.roots must be string[] when provided".to_string(),
            ));
        }
    }

    if let Some(max_depth) = obj.get("maxDepth") {
        if !max_depth.is_number() || max_depth.as_f64().is_none_or(|n| n < 0.0 || !n.is_finite()) {
            return Err(PolicyValidateError::Validation(
                "config.maxDepth must be a non-negative number when provided".to_string(),
            ));
        }
    }

    if let Some(targets) = obj.get("targets") {
        let targets_obj = targets
            .as_object()
            .ok_or_else(|| PolicyValidateError::Validation("config.targets must be an object".to_string()))?;
        assert_only_keys(
            targets_obj,
            &[
                "nodeModules",
                "buildArtifacts",
                "rustArtifacts",
                "goArtifacts",
                "playwrightArtifacts",
            ],
            "config.targets",
        )?;
        for key in [
            "nodeModules",
            "buildArtifacts",
            "rustArtifacts",
            "goArtifacts",
            "playwrightArtifacts",
        ] {
            if let Some(v) = targets_obj.get(key) {
                if !v.is_boolean() {
                    return Err(PolicyValidateError::Validation(format!(
                        "config.targets.{key} must be boolean"
                    )));
                }
            }
        }
    }

    if let Some(additional) = obj.get("additionalDirNames") {
        let additional_obj = additional.as_object().ok_or_else(|| {
            PolicyValidateError::Validation("config.additionalDirNames must be an object".to_string())
        })?;
        assert_only_keys(
            additional_obj,
            &[
                "buildArtifacts",
                "rustArtifacts",
                "goArtifacts",
                "playwrightArtifacts",
            ],
            "config.additionalDirNames",
        )?;
        for key in [
            "buildArtifacts",
            "rustArtifacts",
            "goArtifacts",
            "playwrightArtifacts",
        ] {
            if let Some(v) = additional_obj.get(key) {
                if !is_string_array(v) {
                    return Err(PolicyValidateError::Validation(format!(
                        "config.additionalDirNames.{key} must be string[]"
                    )));
                }
            }
        }
    }

    if let Some(excludes) = obj.get("excludeAbsPathContains") {
        if !is_string_array(excludes) {
            return Err(PolicyValidateError::Validation(
                "config.excludeAbsPathContains must be string[]".to_string(),
            ));
        }
    }

    if let Some(profile) = obj.get("profile") {
        let s = profile.as_str().ok_or_else(|| {
            PolicyValidateError::Validation("config.profile must be a string".to_string())
        })?;
        if !matches!(s, "safe" | "balanced" | "aggressive") {
            return Err(PolicyValidateError::Validation(
                "config.profile must be one of safe|balanced|aggressive".to_string(),
            ));
        }
    }

    if let Some(delete_mode) = obj.get("deleteMode") {
        let s = delete_mode.as_str().ok_or_else(|| {
            PolicyValidateError::Validation("config.deleteMode must be a string".to_string())
        })?;
        if !matches!(s, "quarantine" | "recycle-bin" | "hard-delete") {
            return Err(PolicyValidateError::Validation(
                "config.deleteMode must be one of quarantine|recycle-bin|hard-delete".to_string(),
            ));
        }
    }

    if let Some(stale_days) = obj.get("staleDays") {
        if !stale_days.is_number() || stale_days.as_f64().is_none_or(|n| n < 0.0 || !n.is_finite()) {
            return Err(PolicyValidateError::Validation(
                "config.staleDays must be a non-negative number".to_string(),
            ));
        }
    }

    if let Some(quarantine) = obj.get("quarantine") {
        let q = quarantine
            .as_object()
            .ok_or_else(|| PolicyValidateError::Validation("config.quarantine must be an object".to_string()))?;
        assert_only_keys(q, &["root", "retentionDays"], "config.quarantine")?;
        if let Some(root) = q.get("root") {
            if !root.is_string() {
                return Err(PolicyValidateError::Validation(
                    "config.quarantine.root must be a string".to_string(),
                ));
            }
        }
        if let Some(days) = q.get("retentionDays") {
            if !days.is_number() || days.as_f64().is_none_or(|n| n < 0.0 || !n.is_finite()) {
                return Err(PolicyValidateError::Validation(
                    "config.quarantine.retentionDays must be a non-negative number".to_string(),
                ));
            }
        }
    }

    if let Some(safety) = obj.get("safety") {
        let s = safety
            .as_object()
            .ok_or_else(|| PolicyValidateError::Validation("config.safety must be an object".to_string()))?;
        assert_only_keys(s, &["extraProtectedPathContains", "allowPathContains"], "config.safety")?;
        if let Some(v) = s.get("extraProtectedPathContains") {
            if !is_string_array(v) {
                return Err(PolicyValidateError::Validation(
                    "config.safety.extraProtectedPathContains must be string[]".to_string(),
                ));
            }
        }
        if let Some(v) = s.get("allowPathContains") {
            if !is_string_array(v) {
                return Err(PolicyValidateError::Validation(
                    "config.safety.allowPathContains must be string[]".to_string(),
                ));
            }
        }
    }

    Ok(())
}

fn assert_only_keys(
    obj: &serde_json::Map<String, Value>,
    allowed: &[&str],
    context: &str,
) -> Result<(), PolicyValidateError> {
    let allowed_set: BTreeSet<&str> = allowed.iter().copied().collect();
    for key in obj.keys() {
        if !allowed_set.contains(key.as_str()) {
            return Err(PolicyValidateError::Validation(format!(
                "Unknown key {context}.{key}"
            )));
        }
    }
    Ok(())
}

fn is_string_array(value: &Value) -> bool {
    value
        .as_array()
        .is_some_and(|arr| arr.iter().all(|v| v.is_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::{create_dir_all, write};

    fn repo_root() -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("..")
            .join("..")
            .join("..")
    }

    #[test]
    fn validates_shipped_example_packs() {
        let examples = repo_root().join("examples").join("deco-policies");
        for name in ["monorepo-maintainer", "conservative-no-globals", "ci-quick-scan"] {
            let pack = examples.join(name);
            let summary = validate_policy_input(&pack).expect(name);
            assert!(summary.config_path.ends_with("disk-cleanup.json"));
        }
    }

    #[test]
    fn rejects_unknown_keys() {
        let base = repo_root().join(".tmp-rust-tests").join("policy-validate");
        create_dir_all(&base).unwrap();
        let cfg = base.join("disk-cleanup.json");
        write(&cfg, r#"{"profile":"safe","notARealKey":true}"#).unwrap();
        let err = validate_policy_input(&base).unwrap_err();
        assert!(err.message().contains("Unknown key"));
        let _ = std::fs::remove_dir_all(&base);
    }
}
