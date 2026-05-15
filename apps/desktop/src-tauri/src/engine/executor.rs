use super::quarantine_store::{add_quarantine_entry, quarantine_item_path};
use super::types::{CleanupCandidate, ExecuteResponse, GlobalCacheAllow, Kind, RiskLevel};
use rusqlite::Connection;
use std::fs;
use std::path::Path;

pub fn execute_cleanup(
    conn: &Connection,
    data_dir: &Path,
    candidates: &[CleanupCandidate],
    delete_mode: &str,
    include_review: bool,
    allow_global: GlobalCacheAllow,
    allow_python_venv: bool,
) -> ExecuteResponse {
    let mut deleted_count = 0u32;
    let mut quarantined_count = 0u32;
    let mut skipped_blocked_count = 0u32;
    let mut errors = vec![];
    let mut quarantine_entries = vec![];

    for candidate in candidates {
        if candidate.risk == RiskLevel::Blocked {
            skipped_blocked_count += 1;
            errors.push(format!("Refused blocked target: {}", candidate.abs_path));
            continue;
        }

        if candidate.kind == Kind::GoGlobalCache && !allow_global.go {
            errors.push(format!(
                "Refused global Go cache (enable “Check global Go cache” in settings and re-scan): {}",
                candidate.abs_path
            ));
            continue;
        }
        if candidate.kind == Kind::JvmGlobalCache && !allow_global.jvm {
            errors.push(format!(
                "Refused global JVM cache (enable “Check global JVM cache” in settings and re-scan): {}",
                candidate.abs_path
            ));
            continue;
        }
        if candidate.kind == Kind::IdeGlobalCache && !allow_global.ide {
            errors.push(format!(
                "Refused IDE global cache (enable “Check IDE global cache” in settings and re-scan): {}",
                candidate.abs_path
            ));
            continue;
        }
        if candidate.kind == Kind::PythonVenv && !allow_python_venv {
            errors.push(format!(
                "Refused Python virtualenv (enable “Include Python venv” in settings and re-scan): {}",
                candidate.abs_path
            ));
            continue;
        }

        if candidate.risk == RiskLevel::Review && !include_review {
            continue;
        }

        let path = Path::new(&candidate.abs_path);
        if !path.exists() {
            continue;
        }

        if delete_mode == "hard-delete" {
            let result = if path.is_dir() {
                fs::remove_dir_all(path)
            } else {
                fs::remove_file(path)
            };

            if let Err(e) = result {
                errors.push(format!("Failed hard-delete {}: {}", candidate.abs_path, e));
            } else {
                deleted_count += 1;
            }
            continue;
        }

        let q_path = quarantine_item_path(data_dir, &candidate.id, &candidate.abs_path);
        if let Some(parent) = q_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                errors.push(format!(
                    "Failed creating quarantine dir for {}: {}",
                    candidate.abs_path, e
                ));
                continue;
            }
        }

        if let Err(e) = move_path(path, &q_path) {
            errors.push(format!(
                "Failed to quarantine {}: {}",
                candidate.abs_path, e
            ));
            continue;
        }

        match add_quarantine_entry(
            conn,
            &candidate.abs_path,
            &q_path.to_string_lossy(),
            candidate.size_bytes,
            candidate.reason_codes.join(","),
        ) {
            Ok(entry) => {
                quarantined_count += 1;
                quarantine_entries.push(entry);
            }
            Err(e) => errors.push(e),
        }
    }

    ExecuteResponse {
        deleted_count,
        quarantined_count,
        skipped_blocked_count,
        errors,
        quarantine_entries,
    }
}

fn move_path(src: &Path, dst: &Path) -> Result<(), String> {
    match fs::rename(src, dst) {
        Ok(_) => Ok(()),
        Err(_) => {
            if src.is_dir() {
                copy_dir_all(src, dst)?;
                fs::remove_dir_all(src).map_err(|e| format!("remove source dir failed: {e}"))?;
            } else {
                fs::copy(src, dst).map_err(|e| format!("copy file failed: {e}"))?;
                fs::remove_file(src).map_err(|e| format!("remove source file failed: {e}"))?;
            }
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
