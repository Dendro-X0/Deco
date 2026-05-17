use super::scanner::DiscoveredTarget;
use super::types::{CleanupCandidate, ScanRequest};
use rusqlite::{params, Connection};
use serde::Serialize;
use std::collections::HashSet;
use std::hash::{Hash, Hasher};
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScanMode {
    Full,
    Quick,
}

impl ScanMode {
    pub fn parse(raw: &str) -> Self {
        match raw.trim().to_lowercase().as_str() {
            "quick" | "incremental" | "update" => ScanMode::Quick,
            _ => ScanMode::Full,
        }
    }
}

#[derive(Debug, Serialize)]
struct InventoryConfigKey {
    profile: String,
    stale_days: u32,
    check_go_cache: bool,
    include_python_artifacts: bool,
    include_python_venv: bool,
    include_jvm_artifacts: bool,
    check_jvm_global_cache: bool,
    include_dotnet_artifacts: bool,
    check_ide_global_cache: bool,
    check_npm_cache: bool,
    check_pnpm_store: bool,
    check_yarn_cache: bool,
    check_pip_cache: bool,
    check_uv_cache: bool,
    check_conda_pkgs_cache: bool,
    check_cargo_registry: bool,
    check_bun_cache: bool,
    check_nuget_cache: bool,
    check_composer_cache: bool,
    exclude_abs_path_contains: Vec<String>,
    extra_protected_path_contains: Vec<String>,
    allow_path_contains: Vec<String>,
}

pub fn inventory_fingerprint(req: &ScanRequest) -> String {
    let key = InventoryConfigKey {
        profile: req.profile.clone(),
        stale_days: req.stale_days,
        check_go_cache: req.check_go_cache,
        include_python_artifacts: req.include_python_artifacts,
        include_python_venv: req.include_python_venv,
        include_jvm_artifacts: req.include_jvm_artifacts,
        check_jvm_global_cache: req.check_jvm_global_cache,
        include_dotnet_artifacts: req.include_dotnet_artifacts,
        check_ide_global_cache: req.check_ide_global_cache,
        check_npm_cache: req.check_npm_cache,
        check_pnpm_store: req.check_pnpm_store,
        check_yarn_cache: req.check_yarn_cache,
        check_pip_cache: req.check_pip_cache,
        check_uv_cache: req.check_uv_cache,
        check_conda_pkgs_cache: req.check_conda_pkgs_cache,
        check_cargo_registry: req.check_cargo_registry,
        check_bun_cache: req.check_bun_cache,
        check_nuget_cache: req.check_nuget_cache,
        check_composer_cache: req.check_composer_cache,
        exclude_abs_path_contains: req.exclude_abs_path_contains.clone(),
        extra_protected_path_contains: req.extra_protected_path_contains.clone(),
        allow_path_contains: req.allow_path_contains.clone(),
    };
    let json =
        serde_json::to_string(&key).unwrap_or_else(|_| format!("{:?}", req.profile));
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    json.hash(&mut hasher);
    format!("{:016x}", hasher.finish())
}

pub fn normalize_abs_path(path: &str) -> String {
    let s = path.replace('/', "\\");
    if cfg!(windows) {
        s.to_lowercase()
    } else {
        s
    }
}

pub struct InventorySplit {
    pub reused: Vec<CleanupCandidate>,
    pub remaining: Vec<DiscoveredTarget>,
}

pub fn split_targets_with_inventory(
    conn: &Connection,
    fingerprint: &str,
    targets: Vec<DiscoveredTarget>,
) -> Result<InventorySplit, String> {
    let mut reused = Vec::new();
    let mut remaining = Vec::new();

    for target in targets {
        let key = normalize_abs_path(&target.abs_path);
        if let Some(mut candidate) = lookup_candidate(conn, fingerprint, &key, target.mtime_ms)? {
            candidate.abs_path = target.abs_path.clone();
            // Each scan inserts into `candidates` with a globally unique `id` PK.
            candidate.id = Uuid::new_v4().to_string();
            reused.push(candidate);
        } else {
            remaining.push(target);
        }
    }

    Ok(InventorySplit { reused, remaining })
}

fn lookup_candidate(
    conn: &Connection,
    fingerprint: &str,
    abs_path_key: &str,
    mtime_ms: Option<i64>,
) -> Result<Option<CleanupCandidate>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT candidate_id, kind, mtime_ms, size_bytes, risk, safety_class, reason_codes_json,
                    project_root, stale_days, can_delete, display_reason_summary
             FROM path_inventory
             WHERE abs_path = ?1 AND config_fingerprint = ?2",
        )
        .map_err(|e| format!("inventory lookup prepare failed: {e}"))?;

    let row = stmt
        .query_row(params![abs_path_key, fingerprint], |row| {
            Ok(InventoryRow {
                candidate_id: row.get(0)?,
                kind: row.get(1)?,
                stored_mtime_ms: row.get(2)?,
                size_bytes: row.get::<_, Option<i64>>(3)?,
                risk: row.get(4)?,
                safety_class: row.get(5)?,
                reason_codes_json: row.get(6)?,
                project_root: row.get(7)?,
                stale_days: row.get::<_, Option<i64>>(8)?,
                can_delete: row.get::<_, i64>(9)? != 0,
                display_reason_summary: row.get(10)?,
            })
        });

    let row = match row {
        Ok(r) => r,
        Err(rusqlite::Error::QueryReturnedNoRows) => return Ok(None),
        Err(e) => return Err(format!("inventory lookup failed: {e}")),
    };

    if row.stored_mtime_ms != mtime_ms {
        return Ok(None);
    }

    row.into_candidate()
        .map(Some)
        .map_err(|e| format!("inventory row invalid: {e}"))
}

struct InventoryRow {
    candidate_id: String,
    kind: String,
    stored_mtime_ms: Option<i64>,
    size_bytes: Option<i64>,
    risk: String,
    safety_class: String,
    reason_codes_json: String,
    project_root: Option<String>,
    stale_days: Option<i64>,
    can_delete: bool,
    display_reason_summary: Option<String>,
}

impl InventoryRow {
    fn into_candidate(self) -> Result<CleanupCandidate, String> {
        use super::types::{Kind, RiskLevel, SafetyClass};

        let kind = Kind::from_wire_key(&self.kind)
            .ok_or_else(|| format!("unknown kind {}", self.kind))?;
        let risk = RiskLevel::from_wire_key(&self.risk)
            .ok_or_else(|| format!("unknown risk {}", self.risk))?;
        let safety_class = SafetyClass::from_wire_key(&self.safety_class)
            .ok_or_else(|| format!("unknown safety_class {}", self.safety_class))?;
        let reason_codes: Vec<String> = serde_json::from_str(&self.reason_codes_json)
            .map_err(|e| format!("reason_codes json: {e}"))?;

        Ok(CleanupCandidate {
            id: self.candidate_id,
            kind,
            abs_path: String::new(), // filled by caller with discover path
            size_bytes: self.size_bytes.map(|v| v as u64),
            mtime_ms: self.stored_mtime_ms,
            risk,
            safety_class,
            reason_codes,
            display_reason_summary: self.display_reason_summary,
            can_delete: self.can_delete,
            project_root: self.project_root,
            stale_days: self.stale_days.map(|v| v as u32),
        })
    }
}

pub fn upsert_candidates(
    conn: &Connection,
    fingerprint: &str,
    scan_id: &str,
    candidates: &[CleanupCandidate],
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    for c in candidates {
        let abs_key = normalize_abs_path(&c.abs_path);
        let reasons = serde_json::to_string(&c.reason_codes)
            .map_err(|e| format!("serialize reason codes: {e}"))?;
        conn.execute(
            "INSERT INTO path_inventory (
                abs_path, config_fingerprint, candidate_id, kind, mtime_ms, size_bytes,
                risk, safety_class, reason_codes_json, project_root, stale_days,
                can_delete, display_reason_summary, last_scan_id, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
            ON CONFLICT(abs_path, config_fingerprint) DO UPDATE SET
                candidate_id = excluded.candidate_id,
                kind = excluded.kind,
                mtime_ms = excluded.mtime_ms,
                size_bytes = excluded.size_bytes,
                risk = excluded.risk,
                safety_class = excluded.safety_class,
                reason_codes_json = excluded.reason_codes_json,
                project_root = excluded.project_root,
                stale_days = excluded.stale_days,
                can_delete = excluded.can_delete,
                display_reason_summary = excluded.display_reason_summary,
                last_scan_id = excluded.last_scan_id,
                updated_at = excluded.updated_at",
            params![
                abs_key,
                fingerprint,
                c.id,
                c.kind.wire_key(),
                c.mtime_ms,
                c.size_bytes.map(|v| v as i64),
                c.risk.wire_key(),
                c.safety_class.wire_key(),
                reasons,
                c.project_root,
                c.stale_days.map(|v| v as i64),
                if c.can_delete { 1 } else { 0 },
                c.display_reason_summary,
                scan_id,
                now,
            ],
        )
        .map_err(|e| format!("inventory upsert failed: {e}"))?;
    }
    Ok(())
}

pub fn prune_inventory_under_roots(
    conn: &Connection,
    fingerprint: &str,
    roots: &[String],
    keep_paths: &HashSet<String>,
) -> Result<u32, String> {
    if roots.is_empty() {
        return Ok(0);
    }

    let prefix_clauses: Vec<String> = roots
        .iter()
        .map(|r| {
            let norm = normalize_abs_path(r);
            let prefix = if norm.ends_with('\\') {
                norm
            } else {
                format!("{norm}\\")
            };
            format!("abs_path LIKE '{}%'", prefix.replace('\'', "''"))
        })
        .collect();

    let sql = format!(
        "SELECT abs_path FROM path_inventory WHERE config_fingerprint = ?1 AND ({})",
        prefix_clauses.join(" OR ")
    );

    let mut stmt = conn
        .prepare(&sql)
        .map_err(|e| format!("inventory prune select failed: {e}"))?;

    let mut to_delete: Vec<String> = Vec::new();
    let rows = stmt
        .query_map(params![fingerprint], |row| row.get::<_, String>(0))
        .map_err(|e| format!("inventory prune query failed: {e}"))?;
    for row in rows {
        let path = row.map_err(|e| format!("inventory prune row: {e}"))?;
        if !keep_paths.contains(&path) {
            to_delete.push(path);
        }
    }

    let mut deleted = 0u32;
    for path in to_delete {
        let n = conn
            .execute(
                "DELETE FROM path_inventory WHERE abs_path = ?1 AND config_fingerprint = ?2",
                params![path, fingerprint],
            )
            .map_err(|e| format!("inventory delete failed: {e}"))?;
        if n > 0 {
            deleted += 1;
        }
    }
    Ok(deleted)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::types::{Kind, RiskLevel, SafetyClass};
    use std::env;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().expect("memory db");
        conn.execute_batch(include_str!("../db/schema.sql"))
            .expect("schema");
        conn
    }

    fn sample_candidate(id: &str, path: &str, mtime: i64) -> CleanupCandidate {
        CleanupCandidate {
            id: id.to_string(),
            kind: Kind::NodeModules,
            abs_path: path.to_string(),
            size_bytes: Some(1024),
            mtime_ms: Some(mtime),
            risk: RiskLevel::Safe,
            safety_class: SafetyClass::ProjectArtifact,
            reason_codes: vec!["stale".to_string()],
            display_reason_summary: None,
            can_delete: true,
            project_root: Some("C:\\proj".to_string()),
            stale_days: Some(45),
        }
    }

    #[test]
    fn fingerprint_stable_for_same_request() {
        let req = ScanRequest {
            roots: vec![],
            max_depth: 8,
            profile: "safe".to_string(),
            include_size: true,
            stale_days: 45,
            show_blocked: false,
            check_go_cache: false,
            include_python_artifacts: true,
            include_python_venv: false,
            include_jvm_artifacts: true,
            check_jvm_global_cache: false,
            include_dotnet_artifacts: true,
            check_ide_global_cache: false,
            check_npm_cache: false,
            check_pnpm_store: false,
            check_yarn_cache: false,
            check_pip_cache: false,
            check_uv_cache: false,
            check_conda_pkgs_cache: false,
            check_cargo_registry: false,
            check_bun_cache: false,
            check_nuget_cache: false,
            check_composer_cache: false,
            exclude_abs_path_contains: vec![],
            extra_protected_path_contains: vec![],
            allow_path_contains: vec![],
            scan_mode: "full".to_string(),
        };
        let a = inventory_fingerprint(&req);
        let b = inventory_fingerprint(&req);
        assert_eq!(a, b);
    }

    #[test]
    fn reuse_when_mtime_matches() {
        let conn = test_conn();
        let fp = "testfp";
        let path = env::temp_dir().join("deco-inv-test-nm");
        let path_str = path.to_string_lossy().to_string();
        let c = sample_candidate("id1", &path_str, 1000);
        upsert_candidates(&conn, fp, "scan-1", &[c]).unwrap();

        let targets = vec![DiscoveredTarget {
            kind: Kind::NodeModules,
            abs_path: path_str.clone(),
            mtime_ms: Some(1000),
        }];
        let split = split_targets_with_inventory(&conn, fp, targets).unwrap();
        assert_eq!(split.reused.len(), 1);
        assert_ne!(split.reused[0].id, "id1");
        assert!(split.remaining.is_empty());
    }

    #[test]
    fn reused_candidates_get_fresh_ids_per_scan() {
        let conn = test_conn();
        let fp = "fresh-id-fp";
        let path = env::temp_dir().join("deco-inv-fresh-id");
        let path_str = path.to_string_lossy().to_string();
        let c = sample_candidate("stored-id", &path_str, 1000);
        upsert_candidates(&conn, fp, "scan-1", &[c]).unwrap();

        let targets = vec![DiscoveredTarget {
            kind: Kind::NodeModules,
            abs_path: path_str,
            mtime_ms: Some(1000),
        }];
        let split = split_targets_with_inventory(&conn, fp, targets).unwrap();
        assert_eq!(split.reused.len(), 1);
        assert_ne!(split.reused[0].id, "stored-id");
    }

    #[test]
    fn miss_when_mtime_changes() {
        let conn = test_conn();
        let fp = "testfp2";
        let path = env::temp_dir().join("deco-inv-test-mtime");
        let path_str = path.to_string_lossy().to_string();
        let c = sample_candidate("id2", &path_str, 1000);
        upsert_candidates(&conn, fp, "scan-1", &[c]).unwrap();

        let targets = vec![DiscoveredTarget {
            kind: Kind::NodeModules,
            abs_path: path_str,
            mtime_ms: Some(2000),
        }];
        let split = split_targets_with_inventory(&conn, fp, targets).unwrap();
        assert!(split.reused.is_empty());
        assert_eq!(split.remaining.len(), 1);
    }
}
