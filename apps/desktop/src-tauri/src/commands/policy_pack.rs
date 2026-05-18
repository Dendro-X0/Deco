use crate::engine::policy_validate::{self, PolicyValidateError, ValidatedPolicySummary};
use serde::Serialize;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri::path::BaseDirectory;

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
    pub error: Option<String>,
}

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

#[tauri::command]
pub fn list_policy_pack_examples(app: AppHandle) -> Result<Vec<PolicyPackExampleDto>, String> {
    let root = resolve_examples_root(&app);
    if !root.is_dir() {
        return Ok(vec![]);
    }

    let catalog: [(&str, &str, &str); 3] = [
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
    ];

    let mut out = Vec::new();
    for (id, label, description) in catalog {
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
pub fn preview_policy_pack(source: String, target_root: String) -> PolicyPackPreviewDto {
    let source_path = PathBuf::from(source.trim());
    let target = PathBuf::from(target_root.trim());
    let target_config = target.join(".deco").join("disk-cleanup.json");
    let target_existing = target_config.is_file();

    match policy_validate::validate_policy_input(&source_path) {
        Ok(summary) => PolicyPackPreviewDto {
            ok: true,
            config_path: summary.config_path.to_string_lossy().to_string(),
            summary: summarize_line(&summary),
            target_existing,
            error: None,
        },
        Err(err) => PolicyPackPreviewDto {
            ok: false,
            config_path: String::new(),
            summary: String::new(),
            target_existing,
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

    #[test]
    fn dev_examples_root_exists_in_repo() {
        let root = dev_examples_root();
        assert!(root.is_dir(), "missing {}", root.display());
    }
}
