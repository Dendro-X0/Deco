use crate::engine::policy_validate::{self, PolicyValidateError, ValidatedPolicySummary};
use serde::Serialize;
use serde_json::Value;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyPackExampleDto {
    pub id: String,
    pub label: String,
    pub description: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyPackPreviewDto {
    pub ok: bool,
    pub config_path: String,
    pub summary: String,
    pub target_existing: bool,
    pub existing_summary: Option<String>,
    pub diff_lines: Vec<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PolicyPackContentsDto {
    pub ok: bool,
    pub config_path: String,
    pub summary: String,
    pub json_pretty: String,
    pub error: Option<String>,
}

const PACK_CATALOG: [(&str, &str, &str); 5] = [
    (
        "monorepo-maintainer",
        "Monorepo maintainer",
        "Balanced profile, extra excludes for vendored trees",
    ),
    (
        "conservative-no-globals",
        "Conservative (no globals)",
        "Safe profile; protect CI caches and local SDK paths",
    ),
    (
        "ci-quick-scan",
        "CI quick scan",
        "Shallow depth, narrow excludes for agent scans",
    ),
    (
        "python-data-science",
        "Python / data science",
        "Exclude venvs and notebooks; protect conda env roots",
    ),
    (
        "dotnet-solution",
        ".NET solution",
        "Exclude .vs and packages; extra MSVC output folder names",
    ),
];

fn dev_examples_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("..")
        .join("..")
        .join("examples")
        .join("deco-policies")
}

fn resolve_examples_root(app: &AppHandle) -> PathBuf {
    if let Ok(path) = app.path().resolve("deco-policies", BaseDirectory::Resource) {
        if path.is_dir() {
            return path;
        }
    }
    dev_examples_root()
}

fn summarize_line(summary: &ValidatedPolicySummary) -> String {
    format!(
        "profile={}, roots={}, excludes={}, extraProtected={}, allowPaths={}",
        summary.profile.as_deref().unwrap_or("default"),
        summary.roots_count,
        summary.excludes_count,
        summary.extra_protected_count,
        summary.allow_paths_count,
    )
}

fn map_validate_error(err: PolicyValidateError) -> String {
    err.message()
}

fn value_snapshot(value: &Value) -> String {
    match value {
        Value::Null => "null".to_string(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => n.to_string(),
        Value::String(s) => format!("\"{s}\""),
        Value::Array(arr) => format!("{} entries", arr.len()),
        Value::Object(obj) => format!("{} keys", obj.len()),
    }
}

/// Top-level JSON diff lines for replace preview (incoming replaces existing entirely).
pub fn policy_replace_diff_lines(existing: Option<&Value>, incoming: &Value) -> Vec<String> {
    let Some(existing_obj) = existing.and_then(|v| v.as_object()) else {
        return vec!["No existing policy — a new file will be created.".to_string()];
    };
    let Some(incoming_obj) = incoming.as_object() else {
        return vec!["Incoming policy is not a JSON object.".to_string()];
    };

    let keys: BTreeSet<&String> = existing_obj.keys().chain(incoming_obj.keys()).collect();
    let mut lines = Vec::new();
    for key in keys {
        match (existing_obj.get(key), incoming_obj.get(key)) {
            (None, Some(v)) => lines.push(format!("+ {key}: {}", value_snapshot(v))),
            (Some(_), None) => lines.push(format!("- {key}: removed")),
            (Some(a), Some(b)) if a == b => {}
            (Some(a), Some(b)) => {
                lines.push(format!(
                    "~ {key}: {} → {}",
                    value_snapshot(a),
                    value_snapshot(b)
                ));
            }
            (None, None) => {}
        }
    }
    if lines.is_empty() {
        lines.push("Incoming policy matches existing top-level keys and values.".to_string());
    }
    lines
}

fn read_incoming_value(source: &Path) -> Result<(PathBuf, Value), PolicyValidateError> {
    let config_path = policy_validate::resolve_policy_config_path(source)?;
    policy_validate::validate_policy_config_file(&config_path)?;
    let text = std::fs::read_to_string(&config_path).map_err(|e| {
        PolicyValidateError::Validation(format!("failed reading {}: {e}", config_path.display()))
    })?;
    let parsed: Value = serde_json::from_str(&text).map_err(|e| PolicyValidateError::InvalidJson {
        path: config_path.clone(),
        detail: e.to_string(),
    })?;
    Ok((config_path, parsed))
}

fn read_existing_target_value(target: &Path) -> Option<Value> {
    let target_config = target.join(".deco").join("disk-cleanup.json");
    if !target_config.is_file() {
        return None;
    }
    let text = std::fs::read_to_string(&target_config).ok()?;
    serde_json::from_str(&text).ok()
}

#[tauri::command]
pub fn list_policy_pack_examples(app: AppHandle) -> Result<Vec<PolicyPackExampleDto>, String> {
    let root = resolve_examples_root(&app);
    if !root.is_dir() {
        return Ok(vec![]);
    }

    let mut out = Vec::new();
    for (id, label, description) in PACK_CATALOG {
        let pack = root.join(id);
        if pack.is_dir() {
            out.push(PolicyPackExampleDto {
                id: id.to_string(),
                label: label.to_string(),
                description: description.to_string(),
                path: pack.to_string_lossy().to_string(),
            });
        }
    }
    Ok(out)
}

#[tauri::command]
pub fn read_policy_pack_contents(source: String) -> PolicyPackContentsDto {
    let source_path = PathBuf::from(source.trim());
    match policy_validate::validate_policy_input(&source_path) {
        Ok(summary) => {
            let text = std::fs::read_to_string(&summary.config_path).unwrap_or_default();
            let pretty = serde_json::to_string_pretty(
                &serde_json::from_str::<Value>(&text).unwrap_or(Value::Null),
            )
            .unwrap_or(text);
            PolicyPackContentsDto {
                ok: true,
                config_path: summary.config_path.to_string_lossy().to_string(),
                summary: summarize_line(&summary),
                json_pretty: pretty,
                error: None,
            }
        }
        Err(err) => PolicyPackContentsDto {
            ok: false,
            config_path: String::new(),
            summary: String::new(),
            json_pretty: String::new(),
            error: Some(map_validate_error(err)),
        },
    }
}

#[tauri::command]
pub fn preview_policy_pack(source: String, target_root: String) -> PolicyPackPreviewDto {
    let source_path = PathBuf::from(source.trim());
    let target = PathBuf::from(target_root.trim());
    let existing_value = read_existing_target_value(&target);
    let target_existing = existing_value.is_some();

    let existing_summary = existing_value.as_ref().and_then(|_| {
        let path = target.join(".deco").join("disk-cleanup.json");
        policy_validate::validate_policy_config_file(&path)
            .ok()
            .map(|s| summarize_line(&s))
    });

    match read_incoming_value(&source_path) {
        Ok((config_path, incoming)) => {
            let summary = policy_validate::validate_policy_config_file(&config_path)
                .map(|s| summarize_line(&s))
                .unwrap_or_default();
            let diff_lines = policy_replace_diff_lines(existing_value.as_ref(), &incoming);
            PolicyPackPreviewDto {
                ok: true,
                config_path: config_path.to_string_lossy().to_string(),
                summary,
                target_existing,
                existing_summary,
                diff_lines,
                error: None,
            }
        }
        Err(err) => PolicyPackPreviewDto {
            ok: false,
            config_path: String::new(),
            summary: String::new(),
            target_existing,
            existing_summary,
            diff_lines: vec![],
            error: Some(map_validate_error(err)),
        },
    }
}

#[tauri::command]
pub fn apply_policy_pack(source: String, target_root: String) -> Result<String, String> {
    let source_path = PathBuf::from(source.trim());
    let target = PathBuf::from(target_root.trim());
    if target.as_os_str().is_empty() {
        return Err("Target project folder is required.".to_string());
    }
    if !target.is_dir() {
        return Err(format!("Target folder does not exist: {}", target.display()));
    }

    let summary = policy_validate::validate_policy_input(&source_path)
        .map_err(map_validate_error)?;
    let bytes = std::fs::read(&summary.config_path)
        .map_err(|e| format!("failed reading {}: {e}", summary.config_path.display()))?;

    let deco_dir = target.join(".deco");
    std::fs::create_dir_all(&deco_dir)
        .map_err(|e| format!("failed creating {}: {e}", deco_dir.display()))?;
    let dest = deco_dir.join("disk-cleanup.json");
    std::fs::write(&dest, &bytes).map_err(|e| format!("failed writing {}: {e}", dest.display()))?;

    Ok(dest.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn dev_examples_root_exists_in_repo() {
        let root = dev_examples_root();
        assert!(root.is_dir(), "missing {}", root.display());
    }

    #[test]
    fn diff_reports_profile_change() {
        let existing = json!({"profile": "safe", "maxDepth": 6});
        let incoming = json!({"profile": "balanced", "maxDepth": 10});
        let lines = policy_replace_diff_lines(Some(&existing), &incoming);
        assert!(lines.iter().any(|l| l.contains("profile")));
        assert!(lines.iter().any(|l| l.contains("maxDepth")));
    }

    #[test]
    fn validates_new_example_packs() {
        let root = dev_examples_root();
        for id in [
            "python-data-science",
            "dotnet-solution",
            "monorepo-maintainer",
        ] {
            let pack = root.join(id);
            assert!(
                policy_validate::validate_policy_input(&pack).is_ok(),
                "pack {id}"
            );
        }
    }
}
