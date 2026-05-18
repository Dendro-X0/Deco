use crate::engine::types::{CleanupCandidate, Settings};
use crate::scan_cancel::{ScanCancelHandles, ScanRunPhase};
use rusqlite::Connection;
use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex};

/// Controls for a background cleanup job (cancel + pause).
#[derive(Clone)]
pub struct CleanupJobControls {
    pub cancel: Arc<AtomicBool>,
    pub pause: Arc<AtomicBool>,
}

impl CleanupJobControls {
    pub fn new() -> Self {
        Self {
            cancel: Arc::new(AtomicBool::new(false)),
            pause: Arc::new(AtomicBool::new(false)),
        }
    }
}

pub struct AppState {
    pub db: Mutex<Connection>,
    pub scans: Mutex<HashMap<String, Vec<CleanupCandidate>>>,
    pub scan_cancels: Mutex<HashMap<String, ScanCancelHandles>>,
    pub scan_phases: Mutex<HashMap<String, ScanRunPhase>>,
    pub cleanup_jobs: Mutex<HashMap<String, CleanupJobControls>>,
    pub settings: Mutex<Settings>,
}
