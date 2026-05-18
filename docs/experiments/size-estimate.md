# Size estimate for dependency trees (v0.6.7)

**Setting:** `fast_dependency_size_estimate` (default on)  
**Manifest:** [v0.6.7-manifest.md](../product/v0.6.7-manifest.md)

## Problem

Full directory walks on huge `node_modules` / `target` trees often hit the 30s per-target timeout and show **Not calculated**, while blocking the size phase for minutes.

## Approach

| Step | Behavior |
|------|----------|
| Eligible kinds | `node_modules`, `rust_artifact`, `build_artifact`, `python_venv` |
| Small tree | ≤600 files (shallow count) → exact walk within 12s budget |
| Large tree | Sample up to 8 top-level packages, average × package count |
| Timeout fallback | Capped walk returns **partial estimate** (`~size`) instead of blank |

Candidates gain `reason_codes: ["size_estimated"]`; UI shows `~12.34 MB`.

## Disable

Settings → Scan behavior → **Fast size estimate for dependency trees** (off = legacy full 30s walk).

## Non-goals

- Skipping discover  
- Cross-machine inventory of estimates  
- Exact byte accuracy for reclaim planning on estimated rows (use full scan / spot-check)
