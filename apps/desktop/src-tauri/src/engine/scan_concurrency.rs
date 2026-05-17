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

/// `mode`: `auto` | `low` | `high`
pub fn size_concurrency_plan(mode: &str) -> SizeConcurrencyPlan {
    match mode.trim().to_lowercase().as_str() {
        "low" => SizeConcurrencyPlan {
            batch_size: 8,
            max_in_flight_batches: 1,
        },
        "high" => SizeConcurrencyPlan {
            batch_size: 32,
            max_in_flight_batches: 8,
        },
        _ => {
            let cpus = std::thread::available_parallelism()
                .map(|n| n.get())
                .unwrap_or(4);
            let batches = (cpus / 2).clamp(2, 6);
            SizeConcurrencyPlan {
                batch_size: 25,
                max_in_flight_batches: batches,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn low_mode_is_conservative() {
        let p = size_concurrency_plan("low");
        assert_eq!(p.max_parallel_sizers(), 8);
    }

    #[test]
    fn auto_mode_within_bounds() {
        let p = size_concurrency_plan("auto");
        assert!(p.batch_size >= 20);
        assert!(p.max_in_flight_batches >= 2);
        assert!(p.max_parallel_sizers() <= 25 * 6);
    }
}
