use crate::engine::types::{CleanupCandidate, Settings};
use crate::scan_cancel::{ScanCancelHandles, ScanRunPhase};
use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::Mutex;

pub struct AppState {
    pub db: Mutex<Connection>,
    pub scans: Mutex<HashMap<String, Vec<CleanupCandidate>>>,
    pub scan_cancels: Mutex<HashMap<String, ScanCancelHandles>>,
    pub scan_phases: Mutex<HashMap<String, ScanRunPhase>>,
    pub settings: Mutex<Settings>,
}
