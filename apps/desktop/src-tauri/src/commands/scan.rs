use crate::engine::classifier::classify_targets;
use crate::engine::path_policy::PathPolicy;
use crate::engine::disk_cleanup_config::merge_disk_cleanup_layers;
use crate::engine::scanner::{discover_targets, DiscoverProgressCallback};
use crate::engine::sizer::{dir_size_bytes, DirSizeOutcome};
use rayon::prelude::*;
use crate::engine::types::{
    CleanupCandidate, ClearScanHistoryResponse, DeleteScanHistoryResponse, RiskLevel, RiskTotals,
    ScanHistoryItem, ScanHistoryResponse, ScanRequest, ScanResponse, Totals,
    SCAN_REPORT_SCHEMA_VERSION,
};
use crate::scan_cancel::{
    discovery_canceled, request_cancel, sizing_canceled, ScanCancelHandles, ScanRunPhase,
};
use crate::state::AppState;
use crate::util::scan_roots::{custom_scan_roots, effective_scan_roots};
use rusqlite::params;
use serde::Serialize;
use std::collections::{BTreeSet, HashMap};
use std::path::Path;
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct StartScanResponse {
    pub scan_id: String,
}

#[derive(Debug, Clone, Serialize)]
struct ScanErrorEvent {
    scan_id: String,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
struct ScanProgressEvent {
    scan_id: String,
    phase: String,
    scanned_dirs: u64,
    discovered_targets: u64,
    classified_targets: u64,
    processed_sizes: u64,
    total_size_candidates: u64,
    message: String,
}

#[derive(Debug, Clone, Serialize)]
struct ScanCandidateBatchEvent {
    scan_id: String,
    phase: String,
    candidates: Vec<CleanupCandidate>,
}

#[tauri::command]
pub fn start_scan(
    req: ScanRequest,
    state: State<Arc<AppState>>,
    app: AppHandle,
) -> Result<StartScanResponse, String> {
    let state = state.inner().clone();

    let scan_id = Uuid::new_v4().to_string();
    let cancel_handles = ScanCancelHandles::new();
    {
        let mut cancels = state
            .scan_cancels
            .lock()
            .map_err(|_| "scan cancel mutex poisoned".to_string())?;
        cancels.insert(scan_id.clone(), cancel_handles.clone());
    }
    set_scan_phase(state.as_ref(), &scan_id, ScanRunPhase::Discover);

    let app_handle = app.clone();
    let scan_id_spawn = scan_id.clone();
    thread::Builder::new()
        .name(format!("deco-scan-{}", &scan_id_spawn[..8.min(scan_id_spawn.len())]))
        .spawn(move || {
            let cleanup_id = scan_id_spawn.clone();
            let cleanup_state = state.clone();
            match run_scan(scan_id_spawn.clone(), req, state, app_handle.clone(), cancel_handles) {
                Ok(response) => {
                    let _ = app_handle.emit("scan-complete", response);
                }
                Err(message) => {
                    let _ = app_handle.emit(
                        "scan-error",
                        ScanErrorEvent {
                            scan_id: scan_id_spawn,
                            message,
                        },
                    );
                }
            }
            // Keep cancel handles until the UI receives the terminal event (avoids "scan not found" on late Stop clicks).
            cleanup_scan_job(cleanup_state.as_ref(), &cleanup_id);
        })
        .map_err(|e| format!("failed to start scan thread: {e}"))?;

    Ok(StartScanResponse { scan_id })
}

pub(crate) fn run_scan(
    scan_id: String,
    req: ScanRequest,
    state: Arc<AppState>,
    app: AppHandle,
    cancel_handles: ScanCancelHandles,
) -> Result<ScanResponse, String> {
    let roots = {
        let guard = state
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_string())?;
        if guard.selected_volumes.is_empty() {
            cleanup_cancel_token_arc(&state, &scan_id);
            return Err(
                "Select at least one partition to scan.".to_string(),
            );
        }
        let settings_snapshot = guard.clone();
        let roots = effective_scan_roots(&guard);
        (settings_snapshot, roots)
    };

    let (settings_snapshot, roots) = roots;

    if settings_snapshot.use_custom_scan_roots && custom_scan_roots(&settings_snapshot).is_empty() {
        cleanup_cancel_token_arc(&state, &scan_id);
        return Err(
            "Custom folders is on but the list is empty. Add folders with Browse or turn it off."
                .to_string(),
        );
    }

    if roots.is_empty() {
        cleanup_cancel_token_arc(&state, &scan_id);
        let custom = {
            let guard = state
                .settings
                .lock()
                .map_err(|_| "settings mutex poisoned".to_string())?;
            !guard.roots.is_empty()
        };
        let msg = if custom {
            "No valid scan roots. Custom folders must exist on a selected partition (e.g. add G:\\ and select G:)."
        } else {
            "No valid scan roots. Select at least one partition on the dashboard."
        };
        return Err(msg.to_string());
    }

    let disk = merge_disk_cleanup_layers(&roots)?;

    let merged_excludes: Vec<String> = req
        .exclude_abs_path_contains
        .iter()
        .chain(disk.exclude_abs_path_contains.iter())
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();

    let merged_extra_protected: Vec<String> = req
        .extra_protected_path_contains
        .iter()
        .chain(disk.extra_protected_path_contains.iter())
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();

    let merged_allow: Vec<String> = req
        .allow_path_contains
        .iter()
        .chain(disk.allow_path_contains.iter())
        .cloned()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect();

    let policy = PathPolicy::new(merged_extra_protected, merged_allow);

    emit_progress(
        &app,
        ScanProgressEvent {
            scan_id: scan_id.clone(),
            phase: "discover".to_string(),
            scanned_dirs: 0,
            discovered_targets: 0,
            classified_targets: 0,
            processed_sizes: 0,
            total_size_candidates: 0,
            message: "Scanning directories...".to_string(),
        },
    );

    let scan_id_discover = scan_id.clone();
    let app_discover = app.clone();
    let progress: DiscoverProgressCallback = Arc::new(move |scanned_dirs, discovered, root| {
        let short_root = if root.len() > 48 {
            format!("…{}", &root[root.len().saturating_sub(45)..])
        } else {
            root.to_string()
        };
        emit_progress(
            &app_discover,
            ScanProgressEvent {
                scan_id: scan_id_discover.clone(),
                phase: "discover".to_string(),
                scanned_dirs,
                discovered_targets: discovered as u64,
                classified_targets: 0,
                processed_sizes: 0,
                total_size_candidates: 0,
                message: format!("Scanning {short_root} ({scanned_dirs} dirs, {discovered} found)"),
            },
        );
    });

    let discovery = discover_targets(
        &roots,
        req.max_depth,
        &req.profile,
        &merged_excludes,
        &policy,
        (&req).into(),
        req.check_go_cache,
        &disk.extra_names,
        Some(cancel_handles.discovery.as_ref()),
        Some(progress),
    );

    let mut warnings = discovery.warnings;
    let discovery_stopped = discovery.canceled || discovery_canceled(&cancel_handles);
    let mut sizing_stopped = false;

    if discovery_stopped {
        warnings.push(
            "Directory search stopped; classifying and sizing items already found.".to_string(),
        );
    }

    set_scan_phase(state.as_ref(), &scan_id, ScanRunPhase::Classify);
    emit_progress(
        &app,
        ScanProgressEvent {
            scan_id: scan_id.clone(),
            phase: "classify".to_string(),
            scanned_dirs: discovery.scanned_dirs,
            discovered_targets: discovery.targets.len() as u64,
            classified_targets: 0,
            processed_sizes: 0,
            total_size_candidates: 0,
            message: format!(
                "Classifying {} discovered targets...",
                discovery.targets.len()
            ),
        },
    );

    let mut candidates = classify_targets(discovery.targets, &roots, req.stale_days, &policy);
    emit_candidate_batches(&app, &scan_id, "classify", &candidates, 50);

    if req.include_size {
        set_scan_phase(state.as_ref(), &scan_id, ScanRunPhase::Size);
        const SIZE_BATCH: usize = 25;
        const SIZE_CONCURRENCY_BATCHES: usize = 4;
        let total = candidates.len();
        let mut processed = 0u64;

        for batch_start in (0..total).step_by(SIZE_BATCH * SIZE_CONCURRENCY_BATCHES) {
            if sizing_canceled(&cancel_handles) {
                sizing_stopped = true;
                warnings.push(
                    "Size calculation canceled; items not measured show as not calculated."
                        .to_string(),
                );
                break;
            }

            let batch_end = (batch_start + SIZE_BATCH * SIZE_CONCURRENCY_BATCHES).min(total);
            let sized: Vec<(usize, Option<u64>, Vec<String>)> = candidates[batch_start..batch_end]
                .par_iter()
                .enumerate()
                .map(|(offset, candidate)| {
                    let outcome = dir_size_bytes(Path::new(&candidate.abs_path));
                    let (size, size_warnings) = match outcome {
                        DirSizeOutcome::Measured(bytes) => (Some(bytes), vec![]),
                        DirSizeOutcome::NotCalculated(w) => (None, w),
                    };
                    (batch_start + offset, size, size_warnings)
                })
                .collect();

            let mut chunk: Vec<CleanupCandidate> = Vec::new();
            for (idx, size, mut size_warnings) in sized {
                warnings.append(&mut size_warnings);
                candidates[idx].size_bytes = size;
                chunk.push(candidates[idx].clone());
                processed += 1;
            }

            if !chunk.is_empty() {
                emit_candidate_batch(
                    &app,
                    ScanCandidateBatchEvent {
                        scan_id: scan_id.clone(),
                        phase: "size".to_string(),
                        candidates: chunk,
                    },
                );
            }

            emit_progress(
                &app,
                ScanProgressEvent {
                    scan_id: scan_id.clone(),
                    phase: "size".to_string(),
                    scanned_dirs: discovery.scanned_dirs,
                    discovered_targets: total as u64,
                    classified_targets: total as u64,
                    processed_sizes: processed,
                    total_size_candidates: total as u64,
                    message: format!("Calculating sizes... {processed}/{total}"),
                },
            );
        }
    }

    if discovery_stopped || sizing_stopped {
        warnings.push(format!(
            "Scan canceled ({scan_id}); returning partial results."
        ));
    }

    if !req.show_blocked {
        candidates.retain(|c| c.risk != RiskLevel::Blocked);
    }

    persist_scan(
        &scan_id,
        &roots,
        &req,
        discovery.scanned_dirs,
        &candidates,
        state.as_ref(),
    )?;

    {
        let mut scans = state
            .scans
            .lock()
            .map_err(|_| "scan cache mutex poisoned".to_string())?;
        scans.insert(scan_id.clone(), candidates.clone());
    }

    let (totals_by_risk, totals_by_kind, total_bytes) = aggregate_totals(&candidates);

    emit_progress(
        &app,
        ScanProgressEvent {
            scan_id: scan_id.clone(),
            phase: "done".to_string(),
            scanned_dirs: discovery.scanned_dirs,
            discovered_targets: candidates.len() as u64,
            classified_targets: candidates.len() as u64,
            processed_sizes: candidates
                .iter()
                .filter(|c| c.size_bytes.is_some())
                .count() as u64,
            total_size_candidates: candidates.len() as u64,
            message: format!("Scan complete: {} candidates", candidates.len()),
        },
    );

    set_scan_phase(state.as_ref(), &scan_id, ScanRunPhase::Done);

    Ok(ScanResponse {
        schema_version: SCAN_REPORT_SCHEMA_VERSION.to_string(),
        scan_id,
        scanned_dirs: discovery.scanned_dirs,
        total_bytes,
        candidates,
        totals_by_risk,
        totals_by_kind,
        warnings,
    })
}

#[tauri::command]
pub fn cancel_scan(scan_id: String, state: State<Arc<AppState>>) -> Result<(), String> {
    cancel_scan_core(scan_id, state.inner())
}

pub(crate) fn cancel_scan_core(scan_id: String, state: &AppState) -> Result<(), String> {
    let handles = {
        let cancels = state
            .scan_cancels
            .lock()
            .map_err(|_| "scan cancel mutex poisoned".to_string())?;
        match cancels.get(&scan_id) {
            Some(h) => h.clone(),
            // Scan thread already finished and emitted scan-complete / scan-error.
            None => return Ok(()),
        }
    };
    let phase = {
        let phases = state
            .scan_phases
            .lock()
            .map_err(|_| "scan phase mutex poisoned".to_string())?;
        phases.get(&scan_id).copied().unwrap_or(ScanRunPhase::Discover)
    };
    request_cancel(&handles, phase);
    Ok(())
}

#[tauri::command]
pub fn scan_history(limit: u32, state: State<Arc<AppState>>) -> Result<ScanHistoryResponse, String> {
    scan_history_core(limit, state.inner())
}

pub(crate) fn scan_history_core(
    limit: u32,
    state: &AppState,
) -> Result<ScanHistoryResponse, String> {
    let limit = if limit == 0 { 20 } else { limit.min(100) };
    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT
                s.scan_id,
                s.created_at,
                s.roots_json,
                s.profile,
                s.stale_days,
                s.scanned_dirs,
                s.total_bytes,
                COUNT(c.id) AS candidate_count,
                SUM(CASE WHEN lower(c.risk) = 'safe' THEN 1 ELSE 0 END) AS safe_count,
                SUM(CASE WHEN lower(c.risk) = 'review' THEN 1 ELSE 0 END) AS review_count,
                SUM(CASE WHEN lower(c.risk) = 'blocked' THEN 1 ELSE 0 END) AS blocked_count
            FROM scans s
            LEFT JOIN candidates c ON c.scan_id = s.scan_id
            GROUP BY s.scan_id, s.created_at, s.roots_json, s.profile, s.stale_days, s.scanned_dirs, s.total_bytes
            ORDER BY s.created_at DESC
            LIMIT ?1",
        )
        .map_err(|e| format!("prepare scan history query failed: {e}"))?;

    let rows = stmt
        .query_map(params![limit as i64], |row| {
            let roots_json: String = row.get(2)?;
            let roots = serde_json::from_str::<Vec<String>>(&roots_json).unwrap_or_default();
            Ok(ScanHistoryItem {
                scan_id: row.get(0)?,
                created_at: row.get(1)?,
                roots,
                profile: row.get(3)?,
                stale_days: row.get::<_, i64>(4)? as u32,
                scanned_dirs: row.get::<_, i64>(5)? as u64,
                total_bytes: row.get::<_, i64>(6)? as u64,
                candidate_count: row.get::<_, i64>(7)? as u64,
                safe_count: row.get::<_, i64>(8).unwrap_or(0) as u64,
                review_count: row.get::<_, i64>(9).unwrap_or(0) as u64,
                blocked_count: row.get::<_, i64>(10).unwrap_or(0) as u64,
            })
        })
        .map_err(|e| format!("scan history query failed: {e}"))?;

    let mut items = Vec::new();
    for row in rows {
        items.push(row.map_err(|e| format!("scan history row map failed: {e}"))?);
    }
    Ok(ScanHistoryResponse { items })
}

#[tauri::command]
pub fn delete_scan_history(
    scan_id: String,
    state: State<Arc<AppState>>,
) -> Result<DeleteScanHistoryResponse, String> {
    delete_scan_history_core(&scan_id, state.inner())
}

pub(crate) fn delete_scan_history_core(
    scan_id: &str,
    state: &AppState,
) -> Result<DeleteScanHistoryResponse, String> {
    let scan_id = scan_id.trim();
    if scan_id.is_empty() {
        return Err("scan_id is required".to_string());
    }

    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("begin delete scan history transaction failed: {e}"))?;
    tx.execute(
        "DELETE FROM candidates WHERE scan_id = ?1",
        params![scan_id],
    )
    .map_err(|e| format!("delete scan candidates failed: {e}"))?;
    tx.execute(
        "DELETE FROM scan_events WHERE scan_id = ?1",
        params![scan_id],
    )
    .map_err(|e| format!("delete scan events failed: {e}"))?;
    let deleted_rows = tx
        .execute("DELETE FROM scans WHERE scan_id = ?1", params![scan_id])
        .map_err(|e| format!("delete scan row failed: {e}"))?;
    tx.commit()
        .map_err(|e| format!("commit delete scan history failed: {e}"))?;

    if let Ok(mut scans) = state.scans.lock() {
        scans.remove(scan_id);
    }

    Ok(DeleteScanHistoryResponse {
        deleted: deleted_rows > 0,
    })
}

#[tauri::command]
pub fn clear_scan_history(state: State<Arc<AppState>>) -> Result<ClearScanHistoryResponse, String> {
    clear_scan_history_core(state.inner())
}

pub(crate) fn clear_scan_history_core(
    state: &AppState,
) -> Result<ClearScanHistoryResponse, String> {
    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;
    let tx = conn
        .unchecked_transaction()
        .map_err(|e| format!("begin clear scan history transaction failed: {e}"))?;
    tx.execute("DELETE FROM candidates", [])
        .map_err(|e| format!("clear scan candidates failed: {e}"))?;
    tx.execute("DELETE FROM scan_events", [])
        .map_err(|e| format!("clear scan events failed: {e}"))?;
    let deleted_rows = tx
        .execute("DELETE FROM scans", [])
        .map_err(|e| format!("clear scans failed: {e}"))?;
    tx.commit()
        .map_err(|e| format!("commit clear scan history failed: {e}"))?;

    if let Ok(mut scans) = state.scans.lock() {
        scans.clear();
    }

    Ok(ClearScanHistoryResponse {
        deleted_count: deleted_rows as u32,
    })
}

fn emit_progress(app: &AppHandle, payload: ScanProgressEvent) {
    let _ = app.emit("scan-progress", payload);
}

fn emit_candidate_batch(app: &AppHandle, payload: ScanCandidateBatchEvent) {
    let _ = app.emit("scan-candidate-batch", payload);
}

fn emit_candidate_batches(
    app: &AppHandle,
    scan_id: &str,
    phase: &str,
    candidates: &[CleanupCandidate],
    batch_size: usize,
) {
    for batch in candidates.chunks(batch_size.max(1)) {
        emit_candidate_batch(
            app,
            ScanCandidateBatchEvent {
                scan_id: scan_id.to_string(),
                phase: phase.to_string(),
                candidates: batch.to_vec(),
            },
        );
    }
}

fn set_scan_phase(state: &AppState, scan_id: &str, phase: ScanRunPhase) {
    if let Ok(mut phases) = state.scan_phases.lock() {
        phases.insert(scan_id.to_string(), phase);
    }
}

fn cleanup_scan_job(state: &AppState, scan_id: &str) {
    if let Ok(mut cancels) = state.scan_cancels.lock() {
        cancels.remove(scan_id);
    }
    if let Ok(mut phases) = state.scan_phases.lock() {
        phases.remove(scan_id);
    }
}

fn cleanup_cancel_token_arc(state: &Arc<AppState>, scan_id: &str) {
    cleanup_scan_job(state.as_ref(), scan_id);
}

fn aggregate_totals(candidates: &[CleanupCandidate]) -> (RiskTotals, HashMap<String, Totals>, u64) {
    let mut risk = RiskTotals {
        safe: Totals { count: 0, bytes: 0 },
        review: Totals { count: 0, bytes: 0 },
        blocked: Totals { count: 0, bytes: 0 },
    };
    let mut kind: HashMap<String, Totals> = HashMap::new();
    let mut total = 0u64;

    for c in candidates {
        let size = c.size_bytes.unwrap_or(0);
        if c.size_bytes.is_some() {
            total = total.saturating_add(size);
        }

        match c.risk {
            RiskLevel::Safe => {
                risk.safe.count += 1;
                if c.size_bytes.is_some() {
                    risk.safe.bytes = risk.safe.bytes.saturating_add(size);
                }
            }
            RiskLevel::Review => {
                risk.review.count += 1;
                if c.size_bytes.is_some() {
                    risk.review.bytes = risk.review.bytes.saturating_add(size);
                }
            }
            RiskLevel::Blocked => {
                risk.blocked.count += 1;
                if c.size_bytes.is_some() {
                    risk.blocked.bytes = risk.blocked.bytes.saturating_add(size);
                }
            }
        }

        let key = c.kind.wire_key().to_string();
        let entry = kind.entry(key).or_insert(Totals { count: 0, bytes: 0 });
        entry.count += 1;
        if c.size_bytes.is_some() {
            entry.bytes = entry.bytes.saturating_add(size);
        }
    }

    (risk, kind, total)
}

fn persist_scan(
    scan_id: &str,
    roots: &[String],
    req: &ScanRequest,
    scanned_dirs: u64,
    candidates: &[CleanupCandidate],
    state: &AppState,
) -> Result<(), String> {
    let total_bytes: u64 = candidates.iter().filter_map(|c| c.size_bytes).sum();
    let roots_json =
        serde_json::to_string(roots).map_err(|e| format!("serialize roots failed: {e}"))?;

    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;

    conn.execute(
        "INSERT INTO scans (scan_id, created_at, roots_json, profile, stale_days, scanned_dirs, total_bytes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![
            scan_id,
            chrono::Utc::now().to_rfc3339(),
            roots_json,
            req.profile,
            req.stale_days as i64,
            scanned_dirs as i64,
            total_bytes as i64,
        ],
    )
    .map_err(|e| format!("insert scan failed: {e}"))?;

    for c in candidates {
        let reasons = serde_json::to_string(&c.reason_codes)
            .map_err(|e| format!("serialize reason codes failed: {e}"))?;
        conn.execute(
            "INSERT INTO candidates (id, scan_id, kind, abs_path, size_bytes, mtime_ms, risk, safety_class, reason_codes_json, project_root, stale_days)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                c.id,
                scan_id,
                format!("{:?}", c.kind),
                c.abs_path,
                c.size_bytes.map(|v| v as i64),
                c.mtime_ms,
                format!("{:?}", c.risk),
                format!("{:?}", c.safety_class),
                reasons,
                c.project_root,
                c.stale_days.map(|v| v as i64),
            ],
        )
        .map_err(|e| format!("insert candidate failed: {e}"))?;
    }

    Ok(())
}
