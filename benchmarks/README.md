# Scan pipeline benchmarks (v0.6.2+)

Synthetic fixtures + headless timing for discover → classify → size. See [docs/experiments/scan-performance.md](../docs/experiments/scan-performance.md) and [incremental-inventory.md](../docs/experiments/incremental-inventory.md).

## Synthetic scan (regression guard)

```bash
pnpm benchmark:scan
```

Fixture: `bench-proj-NNN/Cargo.toml` + `target/debug/deps/` under `target/deco-bench-runs/`.

Baseline: `benchmarks/baseline.synthetic.json` — per-phase caps and `regression_ratio_max` on total.

## Quick-update (v0.6.7 L3)

Compares **full scan** (seeds `path_inventory`) vs **quick scan** on the same unchanged tree:

```bash
pnpm benchmark:quick-update
```

Fixture: each project gets `node_modules/` with 30 small files (sizing work). Baseline: `benchmarks/baseline.quick-update.json`.

**Pass criteria:**

- `inventory_reuse_ratio` ≥ 95% (unchanged paths reused)
- **Pipeline speedup** `(classify_ms + size_ms)` ≥ 30% faster on quick pass — this is what incremental inventory optimizes; discover still runs on both passes

Options: `--quick-update`, `--nm-files N`, `--compare-quick path`, `--include-size` (default on for quick-update).

## Common options

`--root PATH` (reuse tree), `--concurrency auto|low|high`, `--json-out results.json`.

Fixtures default to `target/deco-bench-runs/` (avoids Windows `%LocalAppData%` paths pruned by path policy). Override with env `DECO_BENCH_ROOT`.

## CI

Ubuntu job runs `pnpm benchmark:scan` and `pnpm benchmark:quick-update` after unit tests. Tune limits in baseline JSON when the engine legitimately improves.
