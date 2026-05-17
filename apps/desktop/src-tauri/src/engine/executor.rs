use super::quarantine_store::{add_quarantine_entry, quarantine_item_path, QuarantineStorage};
use super::types::{CleanupCandidate, ExecuteResponse, GlobalCacheAllow, Kind, RiskLevel};
use crate::util::native_path::io_path;
use crate::util::volume::same_volume;
use rusqlite::Connection;
use std::fs;
use std::path::Path;

pub fn execute_cleanup(
    conn: &Connection,
    quarantine_storage: &QuarantineStorage,
    candidates: &[CleanupCandidate],
    delete_mode: &str,
    include_review: bool,
    allow_global: GlobalCacheAllow,
    allow_python_venv: bool,
) -> ExecuteResponse {
    let mut deleted_count = 0u32;
    let mut quarantined_count = 0u32;
    let mut skipped_blocked_count = 0u32;
    let mut skipped_review_count = 0u32;
    let mut skipped_not_found_count = 0u32;
    let mut skipped_opt_in_count = 0u32;
    let mut errors = vec![];
    let mut quarantine_entries = vec![];

    let in_place = delete_mode == "delete" || delete_mode == "hard-delete";

    for candidate in candidates {
        if candidate.risk == RiskLevel::Blocked {
            skipped_blocked_count += 1;
            errors.push(format!("Refused blocked target: {}", candidate.abs_path));
            continue;
        }

        if let Some(msg) = opt_in_refusal(&candidate, &allow_global, allow_python_venv) {
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

        if in_place {
            if let Err(e) = delete_in_place(path) {
                errors.push(format!("Failed to delete {}: {}", candidate.abs_path, e));
            } else {
                deleted_count += 1;
            }
            continue;
        }

        let q_path = match quarantine_item_path(quarantine_storage, &candidate.id, &candidate.abs_path)
        {
            Ok(p) => p,
            Err(e) => {
                errors.push(e);
                continue;
            }
        };
        if let Some(parent) = q_path.parent() {
            if let Err(e) = fs::create_dir_all(parent) {
                errors.push(format!(
                    "Failed creating quarantine dir for {}: {}",
                    candidate.abs_path, e
                ));
                continue;
            }
        }

        match move_path(path, &q_path) {
            Ok(()) => match add_quarantine_entry(
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
            },
            Err(e) if candidate.risk == RiskLevel::Safe && is_disk_full_error(&e) => {
                match delete_in_place(path) {
                    Ok(()) => {
                        deleted_count += 1;
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

    ExecuteResponse {
        deleted_count,
        quarantined_count,
        skipped_blocked_count,
        skipped_review_count,
        skipped_not_found_count,
        skipped_opt_in_count,
        errors,
        quarantine_entries,
    }
}

fn delete_in_place(path: &Path) -> Result<(), String> {
    let io = io_path(path);
    if io.is_dir() {
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
