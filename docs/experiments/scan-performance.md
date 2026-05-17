# Experiment: scan performance (v0.6.x)

**Manifest:** [v0.6.0-manifest.md](../product/v0.6.0-manifest.md)

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

## Promotion criteria (manifest C2)

On a reference tree with ≥500 classified candidates, classify phase should show measurable improvement vs v0.5.7 sequential classify (same machine, same tree). No increase in blocked-path or false-safe incidents.
