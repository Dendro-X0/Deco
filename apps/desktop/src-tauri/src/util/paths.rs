use std::path::PathBuf;

pub fn app_data_paths(base: &PathBuf) -> (PathBuf, PathBuf) {
    let db_path = base.join("deco.db");
    let quarantine_root = base.join("quarantine");
    (db_path, quarantine_root)
}