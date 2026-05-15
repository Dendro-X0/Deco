use crate::engine::types::Settings;
use crate::state::AppState;
use rusqlite::params;
use tauri::State;

#[tauri::command]
pub fn get_settings(state: State<AppState>) -> Result<Settings, String> {
    let from_db = {
        let conn = state
            .db
            .lock()
            .map_err(|_| "db mutex poisoned".to_string())?;

        let mut stmt = conn
            .prepare("SELECT value_json FROM settings WHERE key = 'app' LIMIT 1")
            .map_err(|e| format!("failed preparing settings query: {e}"))?;

        let mut rows = stmt
            .query([])
            .map_err(|e| format!("failed querying settings: {e}"))?;

        if let Some(row) = rows
            .next()
            .map_err(|e| format!("failed iterating settings rows: {e}"))?
        {
            let json: String = row
                .get(0)
                .map_err(|e| format!("failed reading settings row: {e}"))?;
            Some(
                serde_json::from_str::<Settings>(&json)
                    .map_err(|e| format!("failed parsing settings json: {e}"))?,
            )
        } else {
            None
        }
    };

    if let Some(settings) = from_db {
        let mut guard = state
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_string())?;
        *guard = settings.clone();
        return Ok(settings);
    }

    let guard = state
        .settings
        .lock()
        .map_err(|_| "settings mutex poisoned".to_string())?;
    Ok(guard.clone())
}

#[tauri::command]
pub fn save_settings(settings: Settings, state: State<AppState>) -> Result<(), String> {
    let mut settings = settings;
    if settings.default_target_gb == 0 {
        settings.default_target_gb = 10;
    }
    if settings.delete_mode == "hard-delete" && !settings.advanced_mode {
        settings.delete_mode = "quarantine".to_string();
    }

    {
        let mut guard = state
            .settings
            .lock()
            .map_err(|_| "settings mutex poisoned".to_string())?;
        *guard = settings.clone();
    }

    let conn = state
        .db
        .lock()
        .map_err(|_| "db mutex poisoned".to_string())?;

    let json = serde_json::to_string(&settings)
        .map_err(|e| format!("failed serializing settings: {e}"))?;

    conn.execute(
        "INSERT INTO settings(key, value_json) VALUES ('app', ?1)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
        params![json],
    )
    .map_err(|e| format!("failed saving settings: {e}"))?;

    Ok(())
}
