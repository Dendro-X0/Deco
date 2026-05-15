use crate::engine::executor::execute_cleanup;
use crate::engine::types::{
    ExecutePreviewResponse, ExecuteRequest, ExecuteResponse, GlobalCacheAllow, PlanRequest,
    PlanResponse, RiskLevel, RiskTotals, Totals,
};
use crate::state::AppState;
use std::collections::{HashMap, HashSet};
use tauri::State;

#[tauri::command]
pub fn execute_cleanup_command(
    req: ExecuteRequest,
    state: State<AppState>,
) -> Result<ExecuteResponse, String> {
    execute_cleanup_core(req, &state)
}

#[tauri::command]
pub fn preview_execute(
    req: ExecuteRequest,
    state: State<AppState>,
) -> Result<ExecutePreviewResponse, String> {
    preview_execute_core(req, &state)
}

#[tauri::command]
pub fn plan_free_space(req: PlanRequest, state: State<AppState>) -> Result<PlanResponse, String> {
    plan_free_space_core(req, &state)
}

pub(crate) fn execute_cleanup_core(
    req: ExecuteRequest,
    state: &AppState,
) -> Result<ExecuteResponse, String> {
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

    let (allow_global, allow_python_venv) = {
        let settings = state
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_string())?;
        (
            GlobalCacheAllow {
                go: settings.check_go_cache,
                jvm: settings.check_jvm_global_cache,
                ide: settings.check_ide_global_cache,
            },
            settings.include_python_venv,
        )
    };

    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;

    Ok(execute_cleanup(
        &conn,
        &state.data_dir,
        &selected,
        &req.delete_mode,
        req.include_review,
        allow_global,
        allow_python_venv,
    ))
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
        mode: req.delete_mode,
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
) -> Result<Vec<crate::engine::types::CleanupCandidate>, String> {
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
