use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitDormancyHint {
    pub days_since_commit: u32,
    pub summary: String,
}

/// Opt-in: last git commit age for a path inside a repo (explain-only; scan does not call this).
#[tauri::command]
pub fn get_git_dormancy_hint(abs_path: String) -> Result<Option<GitDormancyHint>, String> {
    let path = PathBuf::from(abs_path.trim());
    if path.as_os_str().is_empty() {
        return Ok(None);
    }
    let repo_root = find_git_repo_root(&path).ok_or_else(|| "path not found".to_string())?;
    let rel = path
        .strip_prefix(&repo_root)
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|_| path.clone());

    let output = Command::new("git")
        .arg("-C")
        .arg(&repo_root)
        .arg("log")
        .arg("-1")
        .arg("--format=%ct|%s")
        .arg("--")
        .arg(rel.as_os_str())
        .output()
        .map_err(|e| format!("git not available: {e}"))?;

    if !output.status.success() {
        return Ok(None);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let Some(line) = stdout.lines().next() else {
        return Ok(None);
    };
    let line = line.trim();
    if line.is_empty() {
        return Ok(None);
    }

    let (ts_str, summary) = line.split_once('|').unwrap_or((line, ""));
    let ts: i64 = ts_str.trim().parse().map_err(|_| "invalid git timestamp".to_string())?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64;
    let days = ((now - ts) / 86_400).max(0) as u32;
    let summary = summary.trim().chars().take(120).collect::<String>();

    Ok(Some(GitDormancyHint {
        days_since_commit: days,
        summary,
    }))
}

fn find_git_repo_root(path: &Path) -> Option<PathBuf> {
    let mut current = if path.is_file() {
        path.parent()?.to_path_buf()
    } else {
        path.to_path_buf()
    };
    loop {
        if current.join(".git").exists() {
            return Some(current);
        }
        if !current.pop() {
            return None;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn find_git_repo_root_finds_workspace() {
        let root = std::env::current_dir().expect("cwd");
        assert!(find_git_repo_root(&root).is_some());
    }
}
