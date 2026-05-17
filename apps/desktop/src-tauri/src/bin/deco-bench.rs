//! Maintainer scan pipeline benchmark (v0.6.2).
//!
//! Usage:
//!   cargo run --bin deco-bench --manifest-path apps/desktop/src-tauri/Cargo.toml
//!   cargo run --bin deco-bench -- --projects 20 --compare benchmarks/baseline.synthetic.json

use deco_desktop::engine::benchmark::{
    compare_to_baseline, default_bench_request, default_fixture_parent, generate_synthetic_fixture,
    run_scan_pipeline_bench, BenchBaseline, ScanBenchResult,
};
use std::env;
use std::fs;
use std::path::PathBuf;

fn usage() -> &'static str {
    "deco-bench [--projects N] [--root PATH] [--concurrency auto|low|high] [--include-size] [--compare baseline.json] [--json-out path]"
}

fn parse_flag(args: &[String], name: &str) -> bool {
    args.iter().any(|a| a == name)
}

fn parse_value(args: &[String], name: &str) -> Option<String> {
    args.iter()
        .position(|a| a == name)
        .and_then(|i| args.get(i + 1).cloned())
}

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    if parse_flag(&args, "--help") || parse_flag(&args, "-h") {
        eprintln!("{}", usage());
        std::process::exit(0);
    }

    let project_count: usize = parse_value(&args, "--projects")
        .and_then(|s| s.parse().ok())
        .unwrap_or(20);
    let concurrency = parse_value(&args, "--concurrency").unwrap_or_else(|| "auto".to_string());
    let include_size = parse_flag(&args, "--include-size");
    let compare_path = parse_value(&args, "--compare");
    let json_out = parse_value(&args, "--json-out");

    let custom_root = parse_value(&args, "--root");
    let fixture_root = if let Some(root) = custom_root.clone() {
        PathBuf::from(root)
    } else {
        default_fixture_parent().join(format!("run-{}", uuid::Uuid::new_v4()))
    };

    let cleanup_temp = custom_root.is_none();

    if let Err(e) = generate_synthetic_fixture(&fixture_root, project_count) {
        eprintln!("fixture error: {e}");
        std::process::exit(1);
    }

    let root_str = fixture_root.to_string_lossy().to_string();
    let mut req = default_bench_request(include_size);
    req.roots = vec![root_str.clone()];

    let result = match run_scan_pipeline_bench(&[root_str], &req, &concurrency, project_count) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("benchmark failed: {e}");
            if cleanup_temp {
                let _ = fs::remove_dir_all(&fixture_root);
            }
            std::process::exit(1);
        }
    };

    if cleanup_temp {
        let _ = fs::remove_dir_all(&fixture_root);
    }

    print_human(&result);

    let json = serde_json::to_string_pretty(&result).expect("json");
    if let Some(path) = json_out {
        if let Err(e) = fs::write(&path, &json) {
            eprintln!("write {}: {e}", path);
            std::process::exit(1);
        }
        eprintln!("wrote {}", path);
    } else {
        eprintln!("--- json ---");
        eprintln!("{json}");
    }

    if let Some(path) = compare_path {
        let baseline_raw = fs::read_to_string(&path).unwrap_or_else(|e| {
            eprintln!("read baseline {path}: {e}");
            std::process::exit(1);
        });
        let baseline: BenchBaseline = serde_json::from_str(&baseline_raw).unwrap_or_else(|e| {
            eprintln!("parse baseline: {e}");
            std::process::exit(1);
        });
        let outcome = compare_to_baseline(&result, &baseline);
        for msg in &outcome.messages {
            eprintln!("compare: {msg}");
        }
        if !outcome.passed {
            std::process::exit(1);
        }
    }
}

fn print_human(r: &ScanBenchResult) {
    eprintln!("Deco scan benchmark (synthetic {} projects)", r.fixture_projects);
    eprintln!(
        "  discover: {} ms | classify: {} ms | size: {} ms | total: {} ms",
        r.discover_ms, r.classify_ms, r.size_ms, r.total_ms
    );
    eprintln!(
        "  candidates: {} | scanned_dirs: {} | include_size: {} | concurrency: {}",
        r.candidate_count, r.scanned_dirs, r.include_size, r.concurrency_mode
    );
}
