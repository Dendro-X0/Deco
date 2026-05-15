use crate::engine::types::{CleanupCandidate, Settings};
use rusqlite::Connection;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

pub struct AppState {
    pub db: Mutex<Connection>,
    pub data_dir: PathBuf,
    pub scans: Mutex<HashMap<String, Vec<CleanupCandidate>>>,
    pub scan_cancels: Mutex<HashMap<String, Arc<AtomicBool>>>,
    pub settings: Mutex<Settings>,
}
