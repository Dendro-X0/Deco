//! Chunked bulk delete + throughput hints for large cleanups (v0.6.7).

/// Start chunking parallel/sequential deletes when at least this many trees are queued.
pub const CLEANUP_CHUNK_THRESHOLD: usize = 80;
/// Trees per chunk; cancel/pause is honored between chunks.
pub const CLEANUP_CHUNK_SIZE: usize = 40;

pub fn should_chunk_deletes(item_count: usize) -> bool {
    item_count >= CLEANUP_CHUNK_THRESHOLD
}

pub fn chunk_count(item_count: usize) -> usize {
    if item_count == 0 {
        return 0;
    }
    item_count.div_ceil(CLEANUP_CHUNK_SIZE)
}

/// Human-readable rates for progress UI (folders/min and MB/s when enough data).
pub fn format_throughput(folders_done: u32, bytes_freed: u64, elapsed_ms: u64) -> String {
    if elapsed_ms == 0 {
        return "Measuring throughput…".to_string();
    }
    let secs = (elapsed_ms as f64) / 1000.0;
    let folders_per_min = (folders_done as f64 / secs) * 60.0;
    let mut parts = vec![format!("~{folders_per_min:.0} folders/min")];
    if bytes_freed > 0 {
        let mb_per_sec = (bytes_freed as f64) / (1024.0 * 1024.0) / secs;
        if mb_per_sec >= 0.05 {
            parts.push(format!("~{mb_per_sec:.1} MB/s"));
        }
    }
    parts.join(" · ")
}

pub fn format_chunk_boundary_detail(
    chunk_index: usize,
    chunk_total: usize,
    chunk_deleted: u32,
    throughput: &str,
) -> String {
    format!(
        "Chunk {}/{} finished ({chunk_deleted} folders). {throughput}. Stop cancels before the next chunk.",
        chunk_index + 1,
        chunk_total.max(1),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunking_threshold() {
        assert!(!should_chunk_deletes(79));
        assert!(should_chunk_deletes(80));
        assert_eq!(chunk_count(80), 2);
        assert_eq!(chunk_count(120), 3);
    }

    #[test]
    fn throughput_includes_rates() {
        let s = format_throughput(10, 10 * 1024 * 1024, 60_000);
        assert!(s.contains("folders/min"));
        assert!(s.contains("MB/s"));
    }
}
