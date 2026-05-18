pub mod commands;
pub mod db;
pub mod engine;
pub mod scan_cancel;
pub mod state;
pub mod util;

use crate::engine::types::Settings;
use crate::state::AppState;
use db::init_db;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::Mutex;
use tauri::image::Image;
use tauri::path::BaseDirectory;
use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                for name in ["icons/32x32.png", "icons/icon.ico", "icons/icon.png"] {
                    if let Ok(path) = app.path().resolve(name, BaseDirectory::Resource) {
                        if let Ok(icon) = Image::from_path(&path) {
                            let _ = window.set_icon(icon);
                            break;
                        }
                    }
                }
            }

            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("failed resolving app data directory: {e}"))?;
            std::fs::create_dir_all(&data_dir)
                .map_err(|e| format!("failed creating app data directory: {e}"))?;

            let db_path = data_dir.join("deco.db");
            let conn = init_db(&db_path)?;

            app.manage(Arc::new(AppState {
                db: Mutex::new(conn),
                scans: Mutex::new(HashMap::new()),
                scan_cancels: Mutex::new(HashMap::new()),
                scan_phases: Mutex::new(HashMap::new()),
                cleanup_jobs: Mutex::new(HashMap::new()),
                settings: Mutex::new(Settings::default()),
            }));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan::start_scan,
            commands::scan::cancel_scan,
            commands::scan::scan_history,
            commands::scan::delete_scan_history,
            commands::scan::clear_scan_history,
            commands::execute::start_cleanup,
            commands::execute::cancel_cleanup,
            commands::execute::pause_cleanup,
            commands::execute::resume_cleanup,
            commands::execute::execute_cleanup_command,
            commands::execute::preview_execute,
            commands::execute::plan_free_space,
            commands::quarantine::list_quarantine,
            commands::quarantine::list_quarantine_filtered,
            commands::quarantine::restore_quarantine,
            commands::quarantine::restore_quarantine_bulk,
            commands::quarantine::purge_quarantine,
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::suggest_scan_roots_command,
            commands::settings::list_storage_volumes_command,
            commands::classify::classify_targets_preview,
            commands::explorer::reveal_path_in_explorer,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
