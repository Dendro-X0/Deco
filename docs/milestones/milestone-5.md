# Milestone 5 — Performance at scale

## Goal

Large multi-root scans stay responsive: parallel sizing, cancellable phases, fast path without sizes, and walk pruning inside heavy dependency trees.

## What shipped

### Cancellable scans (desktop)

- `cancel_scan` sets a token checked during **discovery** and **sizing**.
- Cancel returns **partial results** (classified candidates + warnings) instead of failing the command.
- UI **Cancel** passes the active `scan_id` (fixed from empty payload).

### Parallel sizing (desktop)

- Size phase uses **rayon** batches (25 targets × 4 batches in flight) with cancel checks between batches.
- Per-target size walk **30s timeout** (matches CLI), recorded in warnings.

### Fast path

- **CLI**: `--no-size` (unchanged).
- **Desktop**: Settings → **Calculate sizes** (`include_size`, default on). Turn off for discovery + classify only.

### Walk pruning

- After visiting known heavy dirs (`node_modules`, `target`, `.git`, build outputs, etc.), the walker **does not descend** (`skip_current_dir` in Rust, early return in CLI).
- Documented list: `SKIP_DESCENT_DIR_NAMES` in `scanner.rs` / `scan.ts`.

### Already in place (M1+)

- CLI concurrent FS via `TaskQueue` (32).
- Desktop incremental `scan-candidate-batch` + phased progress events.

## How to try

```bash
# Fast scan (no sizing)
pnpm dev:cli -- --root . --no-size --max-depth 6

# Desktop: Settings → uncheck Calculate sizes → Scan
# During scan: Cancel (returns partial rows + warning)
```

## Acceptance checklist

- [x] Concurrent sizing where safe (desktop rayon batches; CLI TaskQueue)
- [x] Cancellable long scans with partial results
- [x] Optional fast path (`--no-size` / `include_size`)
- [x] Pruning rules documented; no useless walks inside `node_modules` etc.
