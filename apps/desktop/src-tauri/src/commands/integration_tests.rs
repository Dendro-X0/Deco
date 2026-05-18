use super::execute::{execute_cleanup_core, preview_execute_core};
use super::quarantine::{
    list_quarantine_core, purge_quarantine_core, restore_quarantine_bulk_core,
    restore_quarantine_core,
};
use super::scan::{
    cancel_scan_core, clear_scan_history_core, delete_scan_history_core, scan_history_core,
};
use crate::db::init_db;
use crate::engine::types::{
    CleanupCandidate, ExecuteRequest, Kind, RiskLevel, SafetyClass, Settings,
};
use crate::scan_cancel::{request_cancel, ScanCancelHandles, ScanRunPhase};
use crate::state::AppState;
use rusqlite::params;
use std::collections::HashMap;
use std::fs::{create_dir_all, remove_dir_all, write};
use std::path::PathBuf;
use std::sync::atomic::Ordering;
use std::sync::Mutex;
use uuid::Uuid;

fn temp_root(prefix: &str) -> PathBuf {
    let base = std::env::current_dir()
        .expect("cwd")
        .join("..")
        .join(".tmp-rust-tests");
    create_dir_all(&base).expect("create base");
    let base = std::fs::canonicalize(&base).unwrap_or(base);
    let root = base.join(format!("deco-command-tests-{prefix}-{}", Uuid::new_v4()));
    create_dir_all(&root).expect("create root");
    std::fs::canonicalize(&root).unwrap_or(root)
}

fn candidate(id: &str, abs_path: String, risk: RiskLevel) -> CleanupCandidate {
    let can_delete = risk != RiskLevel::Blocked;
    CleanupCandidate {
        id: id.to_string(),
        kind: Kind::BuildArtifact,
        abs_path,
        size_bytes: Some(1),
        mtime_ms: None,
        risk,
        safety_class: SafetyClass::ProjectArtifact,
        reason_codes: vec!["PROJECT_MARKERS_PRESENT".to_string()],
        display_reason_summary: Some("project markers present".to_string()),
        can_delete,
        project_root: None,
        stale_days: None,
    }
}

fn build_state(root: &PathBuf) -> AppState {
    let data_dir = root.join("data");
    create_dir_all(&data_dir).expect("create data dir");
    let db = init_db(&data_dir.join("deco.db")).expect("init db");

    AppState {
        db: Mutex::new(db),
        scans: Mutex::new(HashMap::new()),
        scan_cancels: Mutex::new(HashMap::new()),
        scan_phases: Mutex::new(HashMap::new()),
        cleanup_cancels: Mutex::new(HashMap::new()),
        settings: Mutex::new(Settings::default()),
    }
}

#[test]
fn execute_quarantine_then_restore_round_trip() {
    let root = temp_root("roundtrip");
    let state = build_state(&root);

    let target = root.join("project").join("dist");
    create_dir_all(&target).expect("create target");
    write(target.join("app.js"), "hello").expect("write file");

    {
        let mut scans = state.scans.lock().expect("lock scans");
        scans.insert(
            "scan-1".to_string(),
            vec![candidate(
                "c1",
                target.to_string_lossy().to_string(),
                RiskLevel::Safe,
            )],
        );
    }

    let req = ExecuteRequest {
        scan_id: "scan-1".to_string(),
        candidate_ids: vec!["c1".to_string()],
        delete_mode: "quarantine".to_string(),
        include_review: false,
    };

    let result = execute_cleanup_core(req, &state).expect("execute cleanup");
    assert_eq!(result.quarantined_count, 1);
    assert!(!target.exists());

    let entries = list_quarantine_core(&state).expect("list quarantine");
    assert_eq!(entries.len(), 1);

    let restored_path =
        restore_quarantine_core(entries[0].id.clone(), &state).expect("restore item");
    assert_eq!(restored_path, target.to_string_lossy().to_string());
    assert!(target.exists());

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn purge_quarantine_removes_entries_from_fs() {
    let root = temp_root("purge");
    let state = build_state(&root);

    let target = root.join("project").join("build");
    create_dir_all(&target).expect("create target");
    write(target.join("artifact.bin"), "data").expect("write file");

    {
        let mut scans = state.scans.lock().expect("lock scans");
        scans.insert(
            "scan-2".to_string(),
            vec![candidate(
                "c2",
                target.to_string_lossy().to_string(),
                RiskLevel::Safe,
            )],
        );
    }

    let req = ExecuteRequest {
        scan_id: "scan-2".to_string(),
        candidate_ids: vec!["c2".to_string()],
        delete_mode: "quarantine".to_string(),
        include_review: false,
    };

    let execute = execute_cleanup_core(req, &state).expect("execute cleanup");
    assert_eq!(execute.quarantined_count, 1);

    let entries_before = list_quarantine_core(&state).expect("list before purge");
    assert_eq!(entries_before.len(), 1);

    let purge = purge_quarantine_core(0, &state).expect("purge entries");
    assert!(purge.purged_count >= 1);

    let entries_after = list_quarantine_core(&state).expect("list after purge");
    assert_eq!(entries_after.len(), 0);

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn review_targets_are_skipped_without_include_review() {
    let root = temp_root("review-skip");
    let state = build_state(&root);

    let target = root.join("project").join("dist-review");
    create_dir_all(&target).expect("create target");
    write(target.join("review.txt"), "r").expect("write file");

    {
        let mut scans = state.scans.lock().expect("lock scans");
        scans.insert(
            "scan-3".to_string(),
            vec![candidate(
                "c3",
                target.to_string_lossy().to_string(),
                RiskLevel::Review,
            )],
        );
    }

    let req = ExecuteRequest {
        scan_id: "scan-3".to_string(),
        candidate_ids: vec!["c3".to_string()],
        delete_mode: "quarantine".to_string(),
        include_review: false,
    };

    let result = execute_cleanup_core(req, &state).expect("execute cleanup");
    assert_eq!(result.quarantined_count, 0);
    assert_eq!(result.skipped_review_count, 1);
    assert!(target.exists());

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn review_targets_are_quarantined_with_include_review_true() {
    let root = temp_root("review-include");
    let state = build_state(&root);

    let target = root.join("project").join("dist-review-2");
    create_dir_all(&target).expect("create target");
    write(target.join("review2.txt"), "r2").expect("write file");

    {
        let mut scans = state.scans.lock().expect("lock scans");
        scans.insert(
            "scan-5".to_string(),
            vec![candidate(
                "c5",
                target.to_string_lossy().to_string(),
                RiskLevel::Review,
            )],
        );
    }

    let req = ExecuteRequest {
        scan_id: "scan-5".to_string(),
        candidate_ids: vec!["c5".to_string()],
        delete_mode: "quarantine".to_string(),
        include_review: true,
    };

    let result = execute_cleanup_core(req, &state).expect("execute cleanup");
    assert_eq!(result.quarantined_count, 1);
    assert!(!target.exists());

    let entries = list_quarantine_core(&state).expect("list quarantine");
    assert_eq!(entries.len(), 1);
    assert_eq!(
        entries[0].original_path,
        target.to_string_lossy().to_string()
    );

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn blocked_targets_are_refused_even_when_selected() {
    let root = temp_root("blocked-refuse");
    let state = build_state(&root);

    let target = root.join("project").join("blocked-target");
    create_dir_all(&target).expect("create target");
    write(target.join("blocked.txt"), "b").expect("write file");

    {
        let mut scans = state.scans.lock().expect("lock scans");
        scans.insert(
            "scan-4".to_string(),
            vec![candidate(
                "c4",
                target.to_string_lossy().to_string(),
                RiskLevel::Blocked,
            )],
        );
    }

    let req = ExecuteRequest {
        scan_id: "scan-4".to_string(),
        candidate_ids: vec!["c4".to_string()],
        delete_mode: "quarantine".to_string(),
        include_review: true,
    };

    let result = execute_cleanup_core(req, &state).expect("execute cleanup");
    assert_eq!(result.skipped_blocked_count, 1);
    assert!(result
        .errors
        .iter()
        .any(|e| e.contains("Refused blocked target")));
    assert!(target.exists());

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn preview_matches_execute_selection_and_risk_breakdown() {
    let root = temp_root("preview-parity");
    let state = build_state(&root);

    let safe_target = root.join("project").join("safe-dist");
    let review_target = root.join("project").join("review-dist");
    let blocked_target = root.join("project").join("blocked-dist");
    create_dir_all(&safe_target).expect("create safe target");
    create_dir_all(&review_target).expect("create review target");
    create_dir_all(&blocked_target).expect("create blocked target");
    write(safe_target.join("a.txt"), "a").expect("write safe file");
    write(review_target.join("b.txt"), "b").expect("write review file");
    write(blocked_target.join("c.txt"), "c").expect("write blocked file");

    {
        let mut scans = state.scans.lock().expect("lock scans");
        scans.insert(
            "scan-preview".to_string(),
            vec![
                candidate(
                    "safe",
                    safe_target.to_string_lossy().to_string(),
                    RiskLevel::Safe,
                ),
                candidate(
                    "review",
                    review_target.to_string_lossy().to_string(),
                    RiskLevel::Review,
                ),
                candidate(
                    "blocked",
                    blocked_target.to_string_lossy().to_string(),
                    RiskLevel::Blocked,
                ),
            ],
        );
    }

    let req = ExecuteRequest {
        scan_id: "scan-preview".to_string(),
        candidate_ids: vec![
            "safe".to_string(),
            "review".to_string(),
            "blocked".to_string(),
        ],
        delete_mode: "quarantine".to_string(),
        include_review: true,
    };

    let preview = preview_execute_core(req.clone(), &state).expect("preview execute");
    assert_eq!(preview.selected_count, 3);
    assert_eq!(preview.review_count, 1);
    assert_eq!(preview.blocked_count, 1);
    assert_eq!(preview.totals_by_risk.safe.count, 1);
    assert_eq!(preview.totals_by_risk.review.count, 1);
    assert_eq!(preview.totals_by_risk.blocked.count, 1);

    let execute = execute_cleanup_core(req, &state).expect("execute cleanup");
    assert_eq!(execute.quarantined_count, 2);
    assert_eq!(execute.skipped_blocked_count, 1);

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn hard_delete_is_blocked_when_advanced_mode_disabled() {
    let root = temp_root("advanced-guard");
    let state = build_state(&root);

    let target = root.join("project").join("dist");
    create_dir_all(&target).expect("create target");
    write(target.join("file.txt"), "x").expect("write target file");

    {
        let mut scans = state.scans.lock().expect("lock scans");
        scans.insert(
            "scan-hard-delete".to_string(),
            vec![candidate(
                "hard",
                target.to_string_lossy().to_string(),
                RiskLevel::Safe,
            )],
        );
    }

    let req = ExecuteRequest {
        scan_id: "scan-hard-delete".to_string(),
        candidate_ids: vec!["hard".to_string()],
        delete_mode: "hard-delete".to_string(),
        include_review: false,
    };

    let err = execute_cleanup_core(req, &state).expect_err("hard delete should be blocked");
    assert!(err.contains("hard-delete is disabled"));
    assert!(target.exists());

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn bulk_restore_reports_successes_and_failures() {
    let root = temp_root("bulk-restore");
    let state = build_state(&root);

    let target1 = root.join("project").join("dist-1");
    let target2 = root.join("project").join("dist-2");
    create_dir_all(&target1).expect("create target1");
    create_dir_all(&target2).expect("create target2");
    write(target1.join("one.txt"), "1").expect("write t1");
    write(target2.join("two.txt"), "2").expect("write t2");

    {
        let mut scans = state.scans.lock().expect("lock scans");
        scans.insert(
            "scan-bulk".to_string(),
            vec![
                candidate(
                    "bulk-1",
                    target1.to_string_lossy().to_string(),
                    RiskLevel::Safe,
                ),
                candidate(
                    "bulk-2",
                    target2.to_string_lossy().to_string(),
                    RiskLevel::Safe,
                ),
            ],
        );
    }

    let req = ExecuteRequest {
        scan_id: "scan-bulk".to_string(),
        candidate_ids: vec!["bulk-1".to_string(), "bulk-2".to_string()],
        delete_mode: "quarantine".to_string(),
        include_review: false,
    };
    let result = execute_cleanup_core(req, &state).expect("execute cleanup");
    assert_eq!(result.quarantined_count, 2);

    let entries = list_quarantine_core(&state).expect("list quarantine");
    assert_eq!(entries.len(), 2);
    let break_id = entries[0].id.clone();
    let ok_id = entries[1].id.clone();

    std::fs::remove_dir_all(&entries[0].quarantined_path).expect("remove quarantined payload");

    let bulk = restore_quarantine_bulk_core(
        vec![break_id.clone(), ok_id.clone(), "missing-id".to_string()],
        &state,
    )
    .expect("bulk restore");

    assert_eq!(bulk.restored_count, 1);
    assert!(bulk.failed_ids.contains(&break_id));
    assert!(bulk.failed_ids.contains(&"missing-id".to_string()));
    assert!(!bulk.failed_ids.contains(&ok_id));

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn cancel_scan_sets_phase_appropriate_token() {
    let root = temp_root("cancel-scan");
    let state = build_state(&root);
    let handles = ScanCancelHandles::new();
    {
        let mut cancels = state.scan_cancels.lock().expect("lock cancels");
        cancels.insert("scan-cancel".to_string(), handles.clone());
        let mut phases = state.scan_phases.lock().expect("lock phases");
        phases.insert("scan-cancel".to_string(), ScanRunPhase::Discover);
    }

    cancel_scan_core("scan-cancel".to_string(), &state).expect("cancel scan");
    assert!(handles.discovery.load(Ordering::Relaxed));
    assert!(!handles.sizing.load(Ordering::Relaxed));

    request_cancel(&handles, ScanRunPhase::Size);
    assert!(handles.sizing.load(Ordering::Relaxed));

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn scan_history_returns_newest_first() {
    let root = temp_root("scan-history");
    let state = build_state(&root);

    {
        let conn = state.db.lock().expect("lock db");
        conn.execute(
            "INSERT INTO scans (scan_id, created_at, roots_json, profile, stale_days, scanned_dirs, total_bytes)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "scan-old",
                "2026-03-01T00:00:00Z",
                "[\"E:/projects\"]",
                "safe",
                45_i64,
                100_i64,
                1024_i64
            ],
        )
        .expect("insert old scan");
        conn.execute(
            "INSERT INTO scans (scan_id, created_at, roots_json, profile, stale_days, scanned_dirs, total_bytes)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                "scan-new",
                "2026-03-02T00:00:00Z",
                "[\"D:/work\"]",
                "balanced",
                30_i64,
                200_i64,
                2048_i64
            ],
        )
        .expect("insert new scan");
        conn.execute(
            "INSERT INTO candidates (id, scan_id, kind, abs_path, size_bytes, mtime_ms, risk, safety_class, reason_codes_json, project_root, stale_days)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                "candidate-safe",
                "scan-new",
                "BuildArtifact",
                "D:/work/project/dist",
                2048_i64,
                Option::<i64>::None,
                "Safe",
                "ProjectArtifact",
                "[\"PROJECT_MARKERS_PRESENT\"]",
                Option::<String>::None,
                Option::<i64>::None
            ],
        )
        .expect("insert candidate");
    }

    let history = scan_history_core(10, &state).expect("scan history");
    assert!(history.items.len() >= 2);
    assert_eq!(history.items[0].scan_id, "scan-new");
    assert_eq!(history.items[1].scan_id, "scan-old");
    assert_eq!(history.items[0].safe_count, 1);

    drop(state);
    remove_dir_all(root).expect("cleanup");
}

#[test]
fn delete_and_clear_scan_history() {
    let root = temp_root("scan-history-delete");
    let state = build_state(&root);

    {
        let conn = state.db.lock().expect("lock db");
        for (id, created) in [("scan-a", "2026-03-01T00:00:00Z"), ("scan-b", "2026-03-02T00:00:00Z")]
        {
            conn.execute(
                "INSERT INTO scans (scan_id, created_at, roots_json, profile, stale_days, scanned_dirs, total_bytes)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![id, created, "[\"F:/\"]", "safe", 45_i64, 10_i64, 1024_i64],
            )
            .expect("insert scan");
        }
    }

    let del = delete_scan_history_core("scan-a", &state).expect("delete one");
    assert!(del.deleted);
    let history = scan_history_core(10, &state).expect("history after delete");
    assert_eq!(history.items.len(), 1);
    assert_eq!(history.items[0].scan_id, "scan-b");

    let cleared = clear_scan_history_core(&state).expect("clear all");
    assert_eq!(cleared.deleted_count, 1);
    let empty = scan_history_core(10, &state).expect("history after clear");
    assert!(empty.items.is_empty());

    drop(state);
    remove_dir_all(root).expect("cleanup");
}
