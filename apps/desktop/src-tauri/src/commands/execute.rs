use crate::engine::executor::{execute_cleanup, CleanupItemProgress};
use crate::engine::quarantine_store::QuarantineStorage;
use crate::engine::types::{
    CleanupCandidate, ExecutePreviewResponse, ExecuteRequest, ExecuteResponse, GlobalCacheAllow,
    PlanRequest, PlanResponse, RiskLevel, RiskTotals, Totals,
};
use crate::state::AppState;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct StartCleanupResponse {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize)]
struct CleanupProgressEvent {
    job_id: String,
    index: u32,
    total: u32,
    abs_path: String,
    action: String,
    stage: String,
    kind: String,
    message: String,
    detail: String,
}

#[derive(Debug, Clone, Serialize)]
struct CleanupCompleteEvent {
    job_id: String,
    result: ExecuteResponse,
}

#[derive(Debug, Clone, Serialize)]
struct CleanupErrorEvent {
    job_id: String,
    message: String,
}

struct CleanupPrepared {
    selected: Vec<CleanupCandidate>,
    delete_mode: String,
    include_review: bool,
    allow_global: GlobalCacheAllow,
    allow_python_venv: bool,
    quarantine_storage: QuarantineStorage,
}

/// Runs cleanup on a background thread so the webview stays responsive during large deletes.
#[tauri::command]
pub fn start_cleanup(
    req: ExecuteRequest,
    state: State<Arc<AppState>>,
    app: AppHandle,
) -> Result<StartCleanupResponse, String> {
    let prepared = prepare_cleanup(&req, state.inner())?;
    let job_id = Uuid::new_v4().to_string();
    let job_id_spawn = job_id.clone();
    let state_arc = state.inner().clone();
    let app_handle = app.clone();

    thread::Builder::new()
        .name(format!(
            "deco-cleanup-{}",
            &job_id_spawn[..8.min(job_id_spawn.len())]
        ))
        .spawn(move || {
            let result = run_cleanup_background(prepared, &state_arc, &app_handle, &job_id_spawn);
            match result {
                Ok(response) => {
                    let _ = app_handle.emit(
                        "cleanup-complete",
                        CleanupCompleteEvent {
                            job_id: job_id_spawn.clone(),
                            result: response,
                        },
                    );
                }
                Err(message) => {
                    let _ = app_handle.emit(
                        "cleanup-error",
                        CleanupErrorEvent {
                            job_id: job_id_spawn,
                            message,
                        },
                    );
                }
            }
        })
        .map_err(|e| format!("failed to start cleanup thread: {e}"))?;

    Ok(StartCleanupResponse { job_id })
}

/// Synchronous cleanup (integration tests). Prefer [`start_cleanup`] in the desktop UI.
#[tauri::command]
pub fn execute_cleanup_command(
    req: ExecuteRequest,
    state: State<Arc<AppState>>,
) -> Result<ExecuteResponse, String> {
    execute_cleanup_core(req, state.inner())
}

#[tauri::command]
pub fn preview_execute(
    req: ExecuteRequest,
    state: State<Arc<AppState>>,
) -> Result<ExecutePreviewResponse, String> {
    preview_execute_core(req, state.inner())
}

#[tauri::command]
pub fn plan_free_space(req: PlanRequest, state: State<Arc<AppState>>) -> Result<PlanResponse, String> {
    plan_free_space_core(req, state.inner())
}

fn run_cleanup_background(
    prepared: CleanupPrepared,
    state: &AppState,
    app: &AppHandle,
    job_id: &str,
) -> Result<ExecuteResponse, String> {
    let mut emit_progress = |progress: CleanupItemProgress| {
        let (message, detail) = cleanup_event_copy(&progress);
        let _ = app.emit(
            "cleanup-progress",
            CleanupProgressEvent {
                job_id: job_id.to_string(),
                index: progress.index,
                total: progress.total,
                abs_path: progress.abs_path.clone(),
                action: progress.action.to_string(),
                stage: progress.stage.to_string(),
                kind: progress.kind_wire.clone(),
                message,
                detail,
            },
        );
    };

    Ok(execute_cleanup(
        &state.db,
        &prepared.quarantine_storage,
        &prepared.selected,
        &prepared.delete_mode,
        prepared.include_review,
        prepared.allow_global,
        prepared.allow_python_venv,
        Some(&mut emit_progress),
    ))
}

pub(crate) fn execute_cleanup_core(
    req: ExecuteRequest,
    state: &AppState,
) -> Result<ExecuteResponse, String> {
    let prepared = prepare_cleanup(&req, state)?;
    Ok(execute_cleanup(
        &state.db,
        &prepared.quarantine_storage,
        &prepared.selected,
        &prepared.delete_mode,
        prepared.include_review,
        prepared.allow_global,
        prepared.allow_python_venv,
        None,
    ))
}

fn cleanup_event_copy(progress: &CleanupItemProgress) -> (String, String) {
    let file_name = std::path::Path::new(&progress.abs_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| progress.abs_path.clone());
    let prefix = if progress.total > 1 {
        format!("Item {}/{}: ", progress.index, progress.total)
    } else {
        String::new()
    };
    let heavy = progress.kind_wire == "node_modules"
        || progress
            .abs_path
            .replace('\\', "/")
            .to_lowercase()
            .contains("/node_modules");

    match progress.stage {
        "remove_tree" => (
            format!("{prefix}Removing {file_name}…"),
            if heavy {
                "node_modules has thousands of small files — the system walks the tree before delete finishes. This can take several minutes even when the folder size looks small.".to_string()
            } else {
                "Walking the directory tree and deleting files. Large build folders take longer than their size suggests.".to_string()
            },
        ),
        "prepare" if progress.action == "delete" => (
            format!("{prefix}Preparing to delete {file_name}…"),
            if heavy {
                "About to remove a dependency folder with many nested files.".to_string()
            } else {
                "Verifying path and starting removal.".to_string()
            },
        ),
        "move" => (
            format!("{prefix}Moving {file_name} to quarantine…"),
            if heavy {
                "Same-drive rename when possible; otherwise copying many files first.".to_string()
            } else {
                "Renaming on the same drive when possible (fast).".to_string()
            },
        ),
        "record" => (
            format!("{prefix}Recording quarantine entry…"),
            "Updating the local restore index.".to_string(),
        ),
        _ if progress.action == "delete" => (
            format!("{prefix}Deleting {file_name}…"),
            "Removing files from disk (not recoverable from Quarantine).".to_string(),
        ),
        _ => (
            format!("{prefix}Cleaning up {file_name}…"),
            "Working in the background — the window stays responsive.".to_string(),
        ),
    }
}

fn prepare_cleanup(req: &ExecuteRequest, state: &AppState) -> Result<CleanupPrepared, String> {
    if req.delete_mode == "hard-delete" {
        let settings = state
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_string())?;
        if !settings.advanced_mode {
            return Err(
                "hard-delete is disabled: enable Advanced Mode in settings first".to_string(),
            );
        }
    }

    let selected = resolve_selected_candidates(state, &req.scan_id, &req.candidate_ids)?;

    let settings = state
        .settings
        .lock()
        .map_err(|_| "settings mutex poisoned".to_string())?
        .clone();

    if settings.delete_mode == "quarantine"
        && settings.quarantine_layout == "custom"
        && settings.quarantine_custom_path.trim().is_empty()
    {
        return Err(
            "Custom quarantine folder is empty. Set a path under Settings → Quarantine storage, \
             or choose “On each source drive”."
                .to_string(),
        );
    }

    let quarantine_storage = QuarantineStorage::from_settings(&settings);
    let allow_global = GlobalCacheAllow {
        go: settings.check_go_cache,
        jvm: settings.check_jvm_global_cache,
        ide: settings.check_ide_global_cache,
        npm: settings.check_npm_cache,
        pnpm: settings.check_pnpm_store,
        yarn: settings.check_yarn_cache,
        pip: settings.check_pip_cache,
        uv: settings.check_uv_cache,
        conda: settings.check_conda_pkgs_cache,
        cargo: settings.check_cargo_registry,
        bun: settings.check_bun_cache,
        nuget: settings.check_nuget_cache,
        composer: settings.check_composer_cache,
    };

    Ok(CleanupPrepared {
        selected,
        delete_mode: req.delete_mode.clone(),
        include_review: req.include_review,
        allow_global,
        allow_python_venv: settings.include_python_venv,
        quarantine_storage,
    })
}

pub(crate) fn preview_execute_core(
    req: ExecuteRequest,
    state: &AppState,
) -> Result<ExecutePreviewResponse, String> {
    if req.delete_mode == "hard-delete" {
        let settings = state
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_string())?;
        if !settings.advanced_mode {
            return Err(
                "hard-delete is disabled: enable Advanced Mode in settings first".to_string(),
            );
        }
    }

    let selected = resolve_selected_candidates(state, &req.scan_id, &req.candidate_ids)?;
    let mut totals_by_risk = RiskTotals {
        safe: Totals { count: 0, bytes: 0 },
        review: Totals { count: 0, bytes: 0 },
        blocked: Totals { count: 0, bytes: 0 },
    };
    let mut totals_by_kind: HashMap<String, Totals> = HashMap::new();
    let mut selected_bytes = 0u64;
    let mut blocked_count = 0u32;
    let mut review_count = 0u32;

    for candidate in &selected {
        let size = candidate.size_bytes.unwrap_or(0);
        selected_bytes = selected_bytes.saturating_add(size);

        let key = candidate.kind.wire_key().to_string();
        let kind_totals = totals_by_kind
            .entry(key)
            .or_insert(Totals { count: 0, bytes: 0 });
        kind_totals.count += 1;
        kind_totals.bytes = kind_totals.bytes.saturating_add(size);

        match candidate.risk {
            RiskLevel::Safe => {
                totals_by_risk.safe.count += 1;
                totals_by_risk.safe.bytes = totals_by_risk.safe.bytes.saturating_add(size);
            }
            RiskLevel::Review => {
                review_count += 1;
                totals_by_risk.review.count += 1;
                totals_by_risk.review.bytes = totals_by_risk.review.bytes.saturating_add(size);
            }
            RiskLevel::Blocked => {
                blocked_count += 1;
                totals_by_risk.blocked.count += 1;
                totals_by_risk.blocked.bytes = totals_by_risk.blocked.bytes.saturating_add(size);
            }
        }
    }

    Ok(ExecutePreviewResponse {
        selected_count: selected.len() as u32,
        selected_bytes,
        mode: req.delete_mode.clone(),
        totals_by_risk,
        totals_by_kind,
        blocked_count,
        review_count,
    })
}

pub(crate) fn plan_free_space_core(
    req: PlanRequest,
    state: &AppState,
) -> Result<PlanResponse, String> {
    let scans = state
        .scans
        .lock()
        .map_err(|_| "scan cache mutex poisoned".to_string())?;
    let candidates = scans
        .get(&req.scan_id)
        .ok_or_else(|| format!("scan not found: {}", req.scan_id))?;

    let target_bytes = (req.target_gb as u64)
        .saturating_mul(1024)
        .saturating_mul(1024)
        .saturating_mul(1024);

    let mut safe_candidates: Vec<_> = candidates
        .iter()
        .filter(|c| c.risk == RiskLevel::Safe)
        .collect();
    safe_candidates.sort_by_key(|c| std::cmp::Reverse(c.size_bytes.unwrap_or(0)));

    let mut review_candidates: Vec<_> = candidates
        .iter()
        .filter(|c| c.risk == RiskLevel::Review && req.include_review)
        .collect();
    review_candidates.sort_by_key(|c| std::cmp::Reverse(c.size_bytes.unwrap_or(0)));

    let mut selected_ids = Vec::new();
    let mut achievable_bytes = 0u64;

    for candidate in safe_candidates.iter().chain(review_candidates.iter()) {
        if achievable_bytes >= target_bytes {
            break;
        }
        selected_ids.push(candidate.id.clone());
        achievable_bytes = achievable_bytes.saturating_add(candidate.size_bytes.unwrap_or(0));
    }

    Ok(PlanResponse {
        target_bytes,
        achievable_bytes,
        selected_count: selected_ids.len() as u32,
        used_review: selected_ids.iter().any(|id| {
            candidates
                .iter()
                .any(|c| &c.id == id && c.risk == RiskLevel::Review)
        }),
        selected_ids,
    })
}

fn resolve_selected_candidates(
    state: &AppState,
    scan_id: &str,
    candidate_ids: &[String],
) -> Result<Vec<CleanupCandidate>, String> {
    let scans = state
        .scans
        .lock()
        .map_err(|_| "scan cache mutex poisoned".to_string())?;
    let candidates = scans
        .get(scan_id)
        .ok_or_else(|| format!("scan not found: {}", scan_id))?;
    let selected_ids: HashSet<&String> = candidate_ids.iter().collect();
    Ok(candidates
        .iter()
        .filter(|c| selected_ids.contains(&c.id))
        .cloned()
        .collect())
}
