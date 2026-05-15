use rusqlite::Connection;
use std::path::Path;

const SCHEMA: &str = include_str!("schema.sql");

pub fn init_db(db_path: &Path) -> Result<Connection, String> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("failed creating db directory: {e}"))?;
    }

    let conn = Connection::open(db_path).map_err(|e| format!("failed opening db: {e}"))?;
    conn.execute_batch(SCHEMA)
        .map_err(|e| format!("failed applying schema: {e}"))?;
    Ok(conn)
}
