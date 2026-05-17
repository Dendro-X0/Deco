use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct ScanCancelHandles {
    pub discovery: Arc<AtomicBool>,
    pub sizing: Arc<AtomicBool>,
}

impl ScanCancelHandles {
    pub fn new() -> Self {
        Self {
            discovery: Arc::new(AtomicBool::new(false)),
            sizing: Arc::new(AtomicBool::new(false)),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ScanRunPhase {
    Discover,
    Classify,
    Size,
    Done,
}

impl ScanRunPhase {
    pub fn cancel_targets_sizing(self) -> bool {
        matches!(self, ScanRunPhase::Classify | ScanRunPhase::Size)
    }
}

pub fn request_cancel(handles: &ScanCancelHandles, phase: ScanRunPhase) {
    if phase == ScanRunPhase::Discover {
        handles.discovery.store(true, Ordering::Relaxed);
    } else if phase.cancel_targets_sizing() {
        handles.sizing.store(true, Ordering::Relaxed);
    }
}

pub fn discovery_canceled(handles: &ScanCancelHandles) -> bool {
    handles.discovery.load(Ordering::Relaxed)
}

pub fn sizing_canceled(handles: &ScanCancelHandles) -> bool {
    handles.sizing.load(Ordering::Relaxed)
}
