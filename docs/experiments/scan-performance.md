# Experiment: scan performance (v0.6.x)

**Manifests:** [v0.6.0](../product/v0.6.0-manifest.md) · [v0.6.2](../product/v0.6.2-manifest.md) (benchmark suite)

## Baseline observation (2026-05)

Drive `E:\` scan (~80+ candidates): discover ~20–30s; classify + size + UI ~30–45s. Bottleneck after discover is **directory size walks**; classify is CPU + scattered `exists` calls.

## v0.6.0 interventions

| Change | Expected effect |
|--------|-----------------|
| Chunked classify → size | Earlier `Sizing…` → bytes in UI |
| Parallel classify + root cache | Lower classify wall time on many candidates |
| Adaptive `scan_concurrency_mode` | HDD: fewer concurrent walks; NVMe: more |

## Manual benchmark protocol

1. Note settings: profile, max depth, volumes, `include_size`, `scan_concurrency_mode`.
2. Run full scan; record status line phase timings when present.
3. Repeat with `low` and `high` on the same tree.
4. Optional: `--no-size` CLI or uncheck Calculate sizes for discover-only timing.

Record: candidate count, discover_ms, classify_ms, size_ms, total wall time.

## Automated suite (v0.6.2+)

```bash
pnpm benchmark:scan
pnpm benchmark:quick-update   # v0.6.7 — full vs quick on unchanged fixture
```

Strict CI parity:

```bash
cargo run --release --bin deco-bench --manifest-path apps/desktop/src-tauri/Cargo.toml -- \
  --projects 20 --compare benchmarks/baseline.synthetic.json
cargo run --release --bin deco-bench --manifest-path apps/desktop/src-tauri/Cargo.toml -- \
  --quick-update --include-size --compare-quick benchmarks/baseline.quick-update.json
```

- **Fixture:** `bench-proj-NNN/Cargo.toml` + `target/debug/deps/` under `target/deco-bench-runs/` (not `%LocalAppData%` — path policy prunes `AppData`).  
- **Output:** JSON with phase ms + `candidate_count`; human summary on stderr.  
- **Baseline:** `benchmarks/baseline.synthetic.json` — per-phase caps and `regression_ratio_max` on total.  
- **Tune limits** only when a change intentionally improves the engine (document in PR).

## Windows USN (v0.8.5+)

Optional NTFS USN **journal probe** (Settings → Experimental) adds scan warnings only; it does not shorten the discover walk yet. See [windows-ntfs-usn-inventory.md](windows-ntfs-usn-inventory.md).

## Promotion criteria (manifest C2)

On a reference tree with ≥500 classified candidates, classify phase should show measurable improvement vs v0.5.7 sequential classify (same machine, same tree). No increase in blocked-path or false-safe incidents.
