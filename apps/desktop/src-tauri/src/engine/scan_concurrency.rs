/// Tunable sizing parallelism for scan phase (v0.6.0).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SizeConcurrencyPlan {
    /// Targets sized per rayon batch inside one in-flight group.
    pub batch_size: usize,
    /// Number of sequential batch groups (each group runs `batch_size` in parallel).
    pub max_in_flight_batches: usize,
}

impl SizeConcurrencyPlan {
    pub fn max_parallel_sizers(&self) -> usize {
        self.batch_size.saturating_mul(self.max_in_flight_batches)
    }
}

/// Worker count for scan sizing, parallel discover splits, and delete batches.
/// `auto` targets ~6 (sweet spot for mixed CPU + HDD); `high` = 8; `low` = 2.
pub fn scan_worker_count(mode: &str) -> usize {
    match mode.trim().to_lowercase().as_str() {
        "low" => 2,
        "high" => 8,
        _ => 6,
    }
}

/// `mode`: `auto` | `low` | `high`
pub fn size_concurrency_plan(mode: &str) -> SizeConcurrencyPlan {
    let workers = scan_worker_count(mode);
    SizeConcurrencyPlan {
        batch_size: workers,
        max_in_flight_batches: 1,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn low_mode_is_conservative() {
        let p = size_concurrency_plan("low");
        assert_eq!(p.max_parallel_sizers(), 2);
    }

    #[test]
    fn auto_mode_targets_six_workers() {
        assert_eq!(scan_worker_count("auto"), 6);
        let p = size_concurrency_plan("auto");
        assert_eq!(p.max_parallel_sizers(), 6);
    }

    #[test]
    fn high_mode_targets_eight_workers() {
        assert_eq!(scan_worker_count("high"), 8);
        let p = size_concurrency_plan("high");
        assert_eq!(p.max_parallel_sizers(), 8);
    }
}
