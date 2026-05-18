use super::cleanup_batch::{
    self, format_chunk_boundary_detail, format_throughput, should_chunk_deletes,
    CLEANUP_CHUNK_SIZE,
};
use super::cleanup_coalesce::coalesce_for_delete;
use super::cleanup_disk_mode::{delete_parallelism_for_cleanup, parse_cleanup_disk_mode};
use super::delete_parallel::is_bulk_tree_delete;
use super::fast_tree_delete::try_delete_tree_fast;
use super::quarantine_store::{add_quarantine_entry, quarantine_item_path, QuarantineStorage};
use super::types::{
    CleanupCandidate, ExecuteResponse, GlobalCacheAllow, Kind, QuarantineEntry, RiskLevel,
    SafetyClass,
};
use crate::util::native_path::io_path;
use crate::util::volume::same_volume;
use rayon::prelude::*;
use rusqlite::Connection;
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct CleanupItemProgress {
    pub index: u32,
    pub total: u32,
    pub abs_path: String,
    pub action: &'static str,
    pub stage: &'static str,
    pub kind_wire: String,
    /// Finished deletes (parallel batch); when set, UI should prefer this over `index`.
    pub completed_count: Option<u32>,
    pub in_flight_count: Option<u32>,
    pub active_summary: Option<String>,
}

type ProgressFn = Arc<dyn Fn(CleanupItemProgress) + Send + Sync>;

fn emit_item_progress(
    on_progress: &Option<ProgressFn>,
    index: u32,
    total: u32,
    candidate: &CleanupCandidate,
    action: &'static str,
    stage: &'static str,
) {
    emit_item_progress_ex(
        on_progress,
        index,
        total,
        candidate,
        action,
        stage,
        None,
        None,
        None,
    );
}

fn emit_item_progress_ex(
    on_progress: &Option<ProgressFn>,
    index: u32,
    total: u32,
    candidate: &CleanupCandidate,
    action: &'static str,
    stage: &'static str,
    completed_count: Option<u32>,
    in_flight_count: Option<u32>,
    active_summary: Option<String>,
) {
    if let Some(progress) = on_progress {
        progress(CleanupItemProgress {
            index,
            total,
            abs_path: candidate.abs_path.clone(),
            action,
            stage,
            kind_wire: candidate.kind.wire_key().to_string(),
            completed_count,
            in_flight_count,
            active_summary,
        });
    }
}

pub fn execute_cleanup(
    db: &Mutex<Connection>,
    quarantine_storage: &QuarantineStorage,
    candidates: Vec<CleanupCandidate>,
    delete_mode: &str,
    include_review: bool,
    allow_global: GlobalCacheAllow,
    allow_python_venv: bool,
    fast_tree_delete_enabled: bool,
    scan_concurrency_mode: &str,
    cleanup_disk_mode: &str,
    cancel: Option<Arc<AtomicBool>>,
    pause: Option<Arc<AtomicBool>>,
    on_progress: Option<ProgressFn>,
) -> ExecuteResponse {
    let (candidates, coalesced_skipped) = coalesce_for_delete(candidates);
    let mut deleted_count = 0u32;
    let mut quarantined_count = 0u32;
    let mut freed_bytes = 0u64;
    let mut skipped_blocked_count = 0u32;
    let mut skipped_review_count = 0u32;
    let mut skipped_not_found_count = 0u32;
    let mut skipped_opt_in_count = 0u32;
    let mut errors = vec![];
    let mut quarantine_entries = vec![];

    let in_place = delete_mode == "delete" || delete_mode == "hard-delete";
    let total = candidates.len() as u32;
    let disk_mode = parse_cleanup_disk_mode(cleanup_disk_mode);
    let delete_parallelism =
        delete_parallelism_for_cleanup(disk_mode, scan_concurrency_mode, candidates.len());
    let mut parallel_batch: Vec<CleanupCandidate> = Vec::new();
    let mut sequential_chunk: Option<SequentialChunkState> = None;
    if in_place && should_chunk_deletes(candidates.len()) {
        sequential_chunk = Some(SequentialChunkState::new(candidates.len()));
    }
    if coalesced_skipped > 0 {
        errors.push(format!(
            "Merged {coalesced_skipped} nested/duplicate paths into parent deletes."
        ));
    }

    for (idx, candidate) in candidates.iter().enumerate() {
        if wait_while_paused_or_canceled(&cancel, &pause) {
            errors.push("Cleanup canceled by user.".to_string());
            break;
        }
        let index = idx as u32 + 1;
        let action = if in_place { "delete" } else { "quarantine" };

        if candidate.risk == RiskLevel::Blocked {
            skipped_blocked_count += 1;
            errors.push(format!("Refused blocked target: {}", candidate.abs_path));
            continue;
        }

        if let Some(msg) = opt_in_refusal(candidate, &allow_global, allow_python_venv) {
            skipped_opt_in_count += 1;
            errors.push(msg);
            continue;
        }

        if candidate.risk == RiskLevel::Review && !include_review {
            skipped_review_count += 1;
            continue;
        }

        let path = Path::new(&candidate.abs_path);
        if !path.exists() {
            skipped_not_found_count += 1;
            continue;
        }

        if in_place
            && delete_parallelism > 1
            && is_bulk_tree_delete(path, &candidate.kind)
        {
            parallel_batch.push(candidate.clone());
            continue;
        }

        emit_item_progress(&on_progress, index, total, candidate, action, "prepare");

        if in_place {
            apply_in_place_delete(
                candidate,
                path,
                index,
                total,
                fast_tree_delete_enabled,
                &on_progress,
                &mut deleted_count,
                &mut freed_bytes,
                &mut errors,
            );
            if let Some(chunk) = sequential_chunk.as_mut() {
                chunk.record(candidate.size_bytes.unwrap_or(0));
                if chunk.should_emit_boundary() {
                    chunk.emit_boundary(
                        &on_progress,
                        deleted_count,
                        total,
                        &cancel,
                        &pause,
                    );
                    if wait_while_paused_or_canceled(&cancel, &pause) {
                        errors.push("Cleanup canceled by user.".to_string());
                        break;
                    }
                }
            }
            continue;
        }

        apply_quarantine(
            db,
            quarantine_storage,
            candidate,
            path,
            index,
            total,
            fast_tree_delete_enabled,
            &on_progress,
            &mut deleted_count,
            &mut quarantined_count,
            &mut freed_bytes,
            &mut errors,
            &mut quarantine_entries,
        );
    }

    if let Some(chunk) = sequential_chunk.as_mut() {
        if chunk.chunk_deleted > 0 {
            chunk.emit_boundary(&on_progress, deleted_count, total, &cancel, &pause);
        }
    }

    if !parallel_batch.is_empty() && !wait_while_paused_or_canceled(&cancel, &pause) {
        let batch_done_before = deleted_count;
        let (p_deleted, p_freed, p_errors) = run_parallel_in_place_deletes(
            parallel_batch,
            total,
            fast_tree_delete_enabled,
            delete_parallelism,
            cancel,
            pause,
            on_progress.clone(),
            batch_done_before,
        );
        deleted_count += p_deleted;
        freed_bytes = freed_bytes.saturating_add(p_freed);
        errors.extend(p_errors);
    }

    ExecuteResponse {
        deleted_count,
        quarantined_count,
        freed_bytes,
        skipped_blocked_count,
        skipped_review_count,
        skipped_not_found_count,
        skipped_opt_in_count,
        errors,
        quarantine_entries,
    }
}

/// Returns true when cleanup should stop (canceled).
fn wait_while_paused_or_canceled(
    cancel: &Option<Arc<AtomicBool>>,
    pause: &Option<Arc<AtomicBool>>,
) -> bool {
    loop {
        if cancel.as_ref().is_some_and(|t| t.load(Ordering::Relaxed)) {
            return true;
        }
        if !pause.as_ref().is_some_and(|p| p.load(Ordering::Relaxed)) {
            return false;
        }
        thread::sleep(Duration::from_millis(250));
    }
}

struct SequentialChunkState {
    chunk_deleted: u32,
    chunk_bytes: u64,
    chunk_started: Instant,
    session_deleted: u32,
    session_bytes: u64,
    session_started: Instant,
    chunk_index: usize,
    chunk_total: usize,
}

impl SequentialChunkState {
    fn new(total_items: usize) -> Self {
        let now = Instant::now();
        Self {
            chunk_deleted: 0,
            chunk_bytes: 0,
            chunk_started: now,
            session_deleted: 0,
            session_bytes: 0,
            session_started: now,
            chunk_index: 0,
            chunk_total: cleanup_batch::chunk_count(total_items),
        }
    }

    fn record(&mut self, bytes: u64) {
        self.chunk_deleted += 1;
        self.chunk_bytes = self.chunk_bytes.saturating_add(bytes);
        self.session_deleted += 1;
        self.session_bytes = self.session_bytes.saturating_add(bytes);
    }

    fn should_emit_boundary(&self) -> bool {
        self.chunk_deleted >= CLEANUP_CHUNK_SIZE as u32
    }

    fn emit_boundary(
        &mut self,
        on_progress: &Option<ProgressFn>,
        done: u32,
        total: u32,
        cancel: &Option<Arc<AtomicBool>>,
        pause: &Option<Arc<AtomicBool>>,
    ) {
        if self.chunk_deleted == 0 {
            return;
        }
        let chunk_elapsed = self.chunk_started.elapsed().as_millis() as u64;
        let session_elapsed = self.session_started.elapsed().as_millis() as u64;
        emit_chunk_boundary(
            on_progress,
            done,
            total,
            self.chunk_index,
            self.chunk_total,
            self.chunk_deleted,
            self.chunk_bytes,
            chunk_elapsed,
            self.session_deleted,
            self.session_bytes,
            session_elapsed,
        );
        self.chunk_index += 1;
        self.chunk_deleted = 0;
        self.chunk_bytes = 0;
        self.chunk_started = Instant::now();
        let _ = (cancel, pause);
    }
}

fn emit_chunk_boundary(
    on_progress: &Option<ProgressFn>,
    done: u32,
    total: u32,
    chunk_index: usize,
    chunk_total: usize,
    chunk_deleted: u32,
    chunk_bytes: u64,
    chunk_elapsed_ms: u64,
    session_deleted: u32,
    session_bytes: u64,
    session_elapsed_ms: u64,
) {
    let chunk_tp = format_throughput(chunk_deleted, chunk_bytes, chunk_elapsed_ms);
    let session_tp = format_throughput(session_deleted, session_bytes, session_elapsed_ms);
    let detail = format_chunk_boundary_detail(chunk_index, chunk_total, chunk_deleted, &chunk_tp);
    let placeholder = CleanupCandidate {
        id: String::new(),
        kind: Kind::NodeModules,
        abs_path: String::new(),
        size_bytes: None,
        mtime_ms: None,
        risk: RiskLevel::Safe,
        safety_class: SafetyClass::ProjectArtifact,
        reason_codes: vec![],
        display_reason_summary: None,
        can_delete: true,
        project_root: None,
        stale_days: None,
    };
    emit_item_progress_ex(
        on_progress,
        done,
        total,
        &placeholder,
        "delete",
        "chunk_boundary",
        Some(done),
        None,
        Some(format!("{detail} Overall: {session_tp}")),
    );
}

fn run_parallel_in_place_deletes(
    mut items: Vec<CleanupCandidate>,
    total: u32,
    fast_tree_delete: bool,
    parallelism: usize,
    cancel: Option<Arc<AtomicBool>>,
    pause: Option<Arc<AtomicBool>>,
    on_progress: Option<ProgressFn>,
    completed_before: u32,
) -> (u32, u64, Vec<String>) {
    items.sort_by_key(|c| c.size_bytes.unwrap_or(u64::MAX));

    if !should_chunk_deletes(items.len()) {
        return run_parallel_chunk(
            items,
            total,
            fast_tree_delete,
            parallelism,
            cancel,
            pause,
            on_progress,
            completed_before,
            None,
        );
    }

    let chunk_total = cleanup_batch::chunk_count(items.len());
    let session_start = Instant::now();
    let session_bytes = Arc::new(AtomicU64::new(0));
    let session_deleted = Arc::new(AtomicU32::new(0));
    let mut total_deleted = 0u32;
    let mut total_freed = 0u64;
    let mut all_errors = Vec::new();
    let mut batch_done = completed_before;
    let mut prev_chunk_deleted = 0u32;
    let mut prev_chunk_bytes = 0u64;
    let mut prev_chunk_elapsed_ms = 0u64;

    for (chunk_idx, chunk) in items.chunks(CLEANUP_CHUNK_SIZE).enumerate() {
        if wait_while_paused_or_canceled(&cancel, &pause) {
            all_errors.push("Cleanup canceled by user.".to_string());
            break;
        }
        if chunk_idx > 0 {
            emit_chunk_boundary(
                &on_progress,
                batch_done,
                total,
                chunk_idx - 1,
                chunk_total,
                prev_chunk_deleted,
                prev_chunk_bytes,
                prev_chunk_elapsed_ms,
                session_deleted.load(Ordering::Relaxed),
                session_bytes.load(Ordering::Relaxed),
                session_start.elapsed().as_millis() as u64,
            );
        }

        let chunk_start = Instant::now();
        let chunk_vec = chunk.to_vec();
        let (d, f, mut e) = run_parallel_chunk(
            chunk_vec,
            total,
            fast_tree_delete,
            parallelism,
            cancel.clone(),
            pause.clone(),
            on_progress.clone(),
            batch_done,
            Some((session_start, Arc::clone(&session_bytes), Arc::clone(&session_deleted))),
        );
        batch_done = batch_done.saturating_add(d);
        total_deleted += d;
        total_freed = total_freed.saturating_add(f);
        all_errors.append(&mut e);
        prev_chunk_deleted = d;
        prev_chunk_bytes = f;
        prev_chunk_elapsed_ms = chunk_start.elapsed().as_millis() as u64;

        if chunk_idx + 1 == chunk_total {
            emit_chunk_boundary(
                &on_progress,
                batch_done,
                total,
                chunk_idx,
                chunk_total,
                d,
                f,
                prev_chunk_elapsed_ms,
                session_deleted.load(Ordering::Relaxed),
                session_bytes.load(Ordering::Relaxed),
                session_start.elapsed().as_millis() as u64,
            );
        }
    }

    (total_deleted, total_freed, all_errors)
}

fn run_parallel_chunk(
    items: Vec<CleanupCandidate>,
    total: u32,
    fast_tree_delete: bool,
    parallelism: usize,
    cancel: Option<Arc<AtomicBool>>,
    pause: Option<Arc<AtomicBool>>,
    on_progress: Option<ProgressFn>,
    completed_before: u32,
    session: Option<(Instant, Arc<AtomicU64>, Arc<AtomicU32>)>,
) -> (u32, u64, Vec<String>) {
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(parallelism.max(1))
        .build()
        .expect("rayon delete pool");
    let batch_total = items.len() as u32;
    let completed = Arc::new(AtomicU32::new(completed_before));
    let done_target = completed_before.saturating_add(batch_total);
    let in_flight = Arc::new(AtomicU32::new(0));
    let deleted = AtomicU32::new(0);
    let freed = std::sync::atomic::AtomicU64::new(0);
    let errors: Mutex<Vec<String>> = Mutex::new(Vec::new());
    let active_paths: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(Vec::new()));
    let stop_heartbeat = Arc::new(AtomicBool::new(false));
    let session_bytes_ref = session.as_ref().map(|(_, b, _)| Arc::clone(b));
    let session_deleted_ref = session.as_ref().map(|(_, _, d)| Arc::clone(d));
    let stage_done = if fast_tree_delete {
        "fast_remove_tree"
    } else {
        "remove_tree"
    };
    let stage_start = if fast_tree_delete {
        "fast_remove_tree_start"
    } else {
        "remove_tree_start"
    };

    let heartbeat = {
        let on_progress = on_progress.clone();
        let completed = Arc::clone(&completed);
        let in_flight = Arc::clone(&in_flight);
        let active_paths = Arc::clone(&active_paths);
        let stop = Arc::clone(&stop_heartbeat);
        let pause_hb = pause.clone();
        thread::spawn(move || {
            let placeholder = CleanupCandidate {
                id: String::new(),
                kind: Kind::NodeModules,
                abs_path: String::new(),
                size_bytes: None,
                mtime_ms: None,
                risk: RiskLevel::Safe,
                safety_class: SafetyClass::ProjectArtifact,
                reason_codes: vec![],
                display_reason_summary: None,
                can_delete: true,
                project_root: None,
                stale_days: None,
            };
            while !stop.load(Ordering::Relaxed) {
                thread::sleep(Duration::from_secs(2));
                if stop.load(Ordering::Relaxed) {
                    break;
                }
                if pause_hb.as_ref().is_some_and(|p| p.load(Ordering::Relaxed)) {
                    continue;
                }
                let c = completed.load(Ordering::Relaxed);
                let n = in_flight.load(Ordering::Relaxed);
                if n == 0 && c >= done_target {
                    break;
                }
                let summary = active_paths_summary(&active_paths);
                emit_item_progress_ex(
                    &on_progress,
                    c,
                    total,
                    &placeholder,
                    "delete",
                    "parallel_pulse",
                    Some(c),
                    Some(n),
                    summary,
                );
            }
        })
    };

    let completed_ref = Arc::clone(&completed);
    let in_flight_ref = Arc::clone(&in_flight);
    let active_ref = Arc::clone(&active_paths);
    let cancel_flag = cancel.clone();
    let pause_flag = pause.clone();

    pool.install(|| {
        items.par_iter().for_each(|candidate| {
            if wait_while_paused_or_canceled(&cancel_flag, &pause_flag) {
                return;
            }
            in_flight_ref.fetch_add(1, Ordering::Relaxed);
            if let Ok(mut active) = active_ref.lock() {
                active.push(candidate.abs_path.clone());
            }
            let c = completed_ref.load(Ordering::Relaxed);
            let n = in_flight_ref.load(Ordering::Relaxed);
            let summary = active_paths_summary(&active_ref);
            emit_item_progress_ex(
                &on_progress,
                c + 1,
                total,
                candidate,
                "delete",
                stage_start,
                Some(c),
                Some(n),
                summary,
            );

            let path = Path::new(&candidate.abs_path);
            match delete_in_place(path, fast_tree_delete, &candidate.kind) {
                Ok(()) => {
                    let bytes = candidate.size_bytes.unwrap_or(0);
                    deleted.fetch_add(1, Ordering::Relaxed);
                    freed.fetch_add(bytes, Ordering::Relaxed);
                    if let Some(ref b) = session_bytes_ref {
                        b.fetch_add(bytes, Ordering::Relaxed);
                    }
                    if let Some(ref d) = session_deleted_ref {
                        d.fetch_add(1, Ordering::Relaxed);
                    }
                }
                Err(e) => {
                    if let Ok(mut errs) = errors.lock() {
                        errs.push(format!("Failed to delete {}: {}", candidate.abs_path, e));
                    }
                }
            }

            if let Ok(mut active) = active_ref.lock() {
                active.retain(|p| p != &candidate.abs_path);
            }
            in_flight_ref.fetch_sub(1, Ordering::Relaxed);
            let done = completed_ref.fetch_add(1, Ordering::Relaxed) + 1;
            let n_after = in_flight_ref.load(Ordering::Relaxed);
            emit_item_progress_ex(
                &on_progress,
                done,
                total,
                candidate,
                "delete",
                stage_done,
                Some(done),
                Some(n_after),
                active_paths_summary(&active_ref),
            );
        });
    });

    stop_heartbeat.store(true, Ordering::Relaxed);
    let _ = heartbeat.join();

    (
        deleted.load(Ordering::Relaxed),
        freed.load(Ordering::Relaxed),
        errors.lock().map(|e| e.clone()).unwrap_or_default(),
    )
}

fn active_paths_summary(active_paths: &Mutex<Vec<String>>) -> Option<String> {
    let paths = active_paths.lock().ok()?;
    if paths.is_empty() {
        return None;
    }
    let mut lines: Vec<String> = paths
        .iter()
        .take(3)
        .map(|p| {
            Path::new(p)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| p.clone())
        })
        .collect();
    if paths.len() > 3 {
        lines.push(format!("+{} more", paths.len() - 3));
    }
    Some(lines.join(", "))
}

fn apply_in_place_delete(
    candidate: &CleanupCandidate,
    path: &Path,
    index: u32,
    total: u32,
    fast_tree_delete_enabled: bool,
    on_progress: &Option<ProgressFn>,
    deleted_count: &mut u32,
    freed_bytes: &mut u64,
    errors: &mut Vec<String>,
) {
    if is_bulk_tree_delete(path, &candidate.kind) {
        let stage = if fast_tree_delete_enabled {
            "fast_remove_tree"
        } else {
            "remove_tree"
        };
        emit_item_progress(on_progress, index, total, candidate, "delete", stage);
    }
    if let Err(e) = delete_in_place(path, fast_tree_delete_enabled, &candidate.kind) {
        errors.push(format!("Failed to delete {}: {}", candidate.abs_path, e));
    } else {
        *deleted_count += 1;
        *freed_bytes = freed_bytes.saturating_add(candidate.size_bytes.unwrap_or(0));
    }
}

fn apply_quarantine(
    db: &Mutex<Connection>,
    quarantine_storage: &QuarantineStorage,
    candidate: &CleanupCandidate,
    path: &Path,
    index: u32,
    total: u32,
    fast_tree_delete_enabled: bool,
    on_progress: &Option<ProgressFn>,
    deleted_count: &mut u32,
    quarantined_count: &mut u32,
    freed_bytes: &mut u64,
    errors: &mut Vec<String>,
    quarantine_entries: &mut Vec<QuarantineEntry>,
) {
    let q_path = match quarantine_item_path(quarantine_storage, &candidate.id, &candidate.abs_path) {
        Ok(p) => p,
        Err(e) => {
            errors.push(e);
            return;
        }
    };
    if let Some(parent) = q_path.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            errors.push(format!(
                "Failed creating quarantine dir for {}: {}",
                candidate.abs_path, e
            ));
            return;
        }
    }

    if is_bulk_tree_delete(path, &candidate.kind) {
        emit_item_progress(on_progress, index, total, candidate, "quarantine", "move");
    }

    match move_path(path, &q_path) {
        Ok(()) => {
            emit_item_progress(on_progress, index, total, candidate, "quarantine", "record");
            let db_result = db
                .lock()
                .map_err(|_| "db mutex poisoned".to_string())
                .and_then(|conn| {
                    add_quarantine_entry(
                        &conn,
                        &candidate.abs_path,
                        &q_path.to_string_lossy(),
                        candidate.size_bytes,
                        candidate.reason_codes.join(","),
                    )
                });
            match db_result {
                Ok(entry) => {
                    *quarantined_count += 1;
                    *freed_bytes = freed_bytes.saturating_add(candidate.size_bytes.unwrap_or(0));
                    quarantine_entries.push(entry);
                }
                Err(e) => errors.push(e),
            }
        }
        Err(e) if candidate.risk == RiskLevel::Safe && is_disk_full_error(&e) => {
            match delete_in_place(path, fast_tree_delete_enabled, &candidate.kind) {
                Ok(()) => {
                    *deleted_count += 1;
                    *freed_bytes = freed_bytes.saturating_add(candidate.size_bytes.unwrap_or(0));
                    errors.push(format!(
                        "Disk full for quarantine copy; deleted in place instead: {}",
                        candidate.abs_path
                    ));
                }
                Err(del_err) => {
                    errors.push(format!(
                        "Failed to quarantine {} ({}); in-place delete also failed: {}",
                        candidate.abs_path, e, del_err
                    ));
                }
            }
        }
        Err(e) => errors.push(format!(
            "Failed to quarantine {}: {}",
            candidate.abs_path, e
        )),
    }
}

fn delete_in_place(path: &Path, fast_tree_delete: bool, kind: &Kind) -> Result<(), String> {
    let io = io_path(path);
    if io.is_dir() {
        if fast_tree_delete && is_bulk_tree_delete(path, kind) {
            if try_delete_tree_fast(path).is_ok() && !path.exists() {
                return Ok(());
            }
        }
        fs::remove_dir_all(&io).map_err(|e| format!("{e}"))
    } else {
        fs::remove_file(&io).map_err(|e| format!("{e}"))
    }
}

fn is_disk_full_error(message: &str) -> bool {
    let lower = message.to_lowercase();
    lower.contains("not enough space")
        || lower.contains("no space left")
        || lower.contains("os error 112")
        || lower.contains("os error 28")
}

fn opt_in_refusal(
    candidate: &CleanupCandidate,
    allow_global: &GlobalCacheAllow,
    allow_python_venv: bool,
) -> Option<String> {
    let path = &candidate.abs_path;
    match candidate.kind {
        Kind::GoGlobalCache if !allow_global.go => Some(format!(
            "Refused global Go cache (enable “Check global Go cache” in settings and re-scan): {path}"
        )),
        Kind::JvmGlobalCache if !allow_global.jvm => Some(format!(
            "Refused global JVM cache (enable “Check global JVM cache” in settings and re-scan): {path}"
        )),
        Kind::IdeGlobalCache if !allow_global.ide => Some(format!(
            "Refused IDE global cache (enable “Check IDE global cache” in settings and re-scan): {path}"
        )),
        Kind::NpmGlobalCache if !allow_global.npm => Some(format!(
            "Refused npm cache (enable “Check npm cache” in settings and re-scan): {path}"
        )),
        Kind::PnpmGlobalStore if !allow_global.pnpm => Some(format!(
            "Refused pnpm store (enable “Check pnpm store” in settings and re-scan): {path}"
        )),
        Kind::YarnGlobalCache if !allow_global.yarn => Some(format!(
            "Refused Yarn cache (enable “Check Yarn cache” in settings and re-scan): {path}"
        )),
        Kind::PipGlobalCache if !allow_global.pip => Some(format!(
            "Refused pip cache (enable “Check pip cache” in settings and re-scan): {path}"
        )),
        Kind::UvGlobalCache if !allow_global.uv => Some(format!(
            "Refused uv cache (enable “Check uv cache” in settings and re-scan): {path}"
        )),
        Kind::CondaPkgsCache if !allow_global.conda => Some(format!(
            "Refused Conda package cache (enable “Conda pkgs cache” in settings and re-scan): {path}"
        )),
        Kind::CargoRegistryCache if !allow_global.cargo => Some(format!(
            "Refused Cargo registry cache (enable “Cargo registry cache” in settings and re-scan): {path}"
        )),
        Kind::BunGlobalCache if !allow_global.bun => Some(format!(
            "Refused bun cache (enable “bun cache” in settings and re-scan): {path}"
        )),
        Kind::NugetGlobalCache if !allow_global.nuget => Some(format!(
            "Refused NuGet packages folder (enable “NuGet global packages” in settings and re-scan): {path}"
        )),
        Kind::ComposerGlobalCache if !allow_global.composer => Some(format!(
            "Refused Composer cache (enable “Composer cache” in settings and re-scan): {path}"
        )),
        Kind::VcpkgInstalledCache if !allow_global.vcpkg => Some(format!(
            "Refused vcpkg installed tree (enable “vcpkg installed” in settings and re-scan): {path}"
        )),
        Kind::ConanGlobalCache if !allow_global.conan => Some(format!(
            "Refused Conan package cache (enable “Conan cache” in settings and re-scan): {path}"
        )),
        Kind::CcacheGlobalCache if !allow_global.ccache => Some(format!(
            "Refused ccache directory (enable “ccache” in settings and re-scan): {path}"
        )),
        Kind::SccacheGlobalCache if !allow_global.sccache => Some(format!(
            "Refused sccache directory (enable “sccache” in settings and re-scan): {path}"
        )),
        Kind::BazelDiskCache if !allow_global.bazel_disk => Some(format!(
            "Refused Bazel disk cache (enable “Bazel disk cache” in settings and re-scan): {path}"
        )),
        Kind::PythonVenv if !allow_python_venv => Some(format!(
            "Refused Python virtualenv (enable “Include Python venv” in settings and re-scan): {path}"
        )),
        _ => None,
    }
}

fn move_path(src: &Path, dst: &Path) -> Result<(), String> {
    if !same_volume(src, dst) {
        return Err(
            "quarantine destination is on a different drive (would require copying). \
             Use Settings → Delete mode → “Delete in place” when the disk is full."
                .to_string(),
        );
    }

    let src_io = io_path(src);
    let dst_io = io_path(dst);
    match fs::rename(&src_io, &dst_io) {
        Ok(_) => Ok(()),
        Err(rename_err) => {
            if src_io.is_dir() {
                copy_dir_all(&src_io, &dst_io)?;
                fs::remove_dir_all(&src_io)
                    .map_err(|e| format!("remove source dir failed: {e}"))?;
            } else {
                fs::copy(&src_io, &dst_io).map_err(|e| format!("copy file failed: {e}"))?;
                fs::remove_file(&src_io).map_err(|e| format!("remove source file failed: {e}"))?;
            }
            let _ = rename_err;
            Ok(())
        }
    }
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| format!("create dst dir failed: {e}"))?;
    for entry in fs::read_dir(src).map_err(|e| format!("read dir failed: {e}"))? {
        let entry = entry.map_err(|e| format!("read dir entry failed: {e}"))?;
        let ty = entry
            .file_type()
            .map_err(|e| format!("entry file_type failed: {e}"))?;
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dst.join(entry.file_name()))?;
        } else {
            fs::copy(entry.path(), dst.join(entry.file_name()))
                .map_err(|e| format!("copy nested file failed: {e}"))?;
        }
    }
    Ok(())
}
