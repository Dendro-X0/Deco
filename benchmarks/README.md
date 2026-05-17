# Scan pipeline benchmarks (v0.6.2)

Synthetic fixture (Rust `target/debug/deps` trees under `bench-proj-NNN/`) + headless timing for discover → classify → size. See [docs/experiments/scan-performance.md](../docs/experiments/scan-performance.md).

## Run locally

```bash
pnpm benchmark:scan
```

Or with baseline guard:

```bash
cargo run --release --bin deco-bench --manifest-path apps/desktop/src-tauri/Cargo.toml -- \
  --projects 20 \
  --compare benchmarks/baseline.synthetic.json
```

Options: `--root PATH` (reuse tree), `--concurrency auto|low|high`, `--include-size`, `--json-out results.json`.

Fixtures default to `target/deco-bench-runs/` under the repo (avoids Windows `%LocalAppData%` paths that path policy prunes). Override with env `DECO_BENCH_ROOT`.

## CI

Ubuntu job runs `deco-bench --compare benchmarks/baseline.synthetic.json` after unit tests. Tune limits in `baseline.synthetic.json` when the engine legitimately improves.
