use std::path::Path;

pub fn ensure_parent(path: &Path) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("failed creating parent dirs: {e}"))?;
    }
    Ok(())
}