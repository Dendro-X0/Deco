# Incremental inventory experiment

**Manifest:** [v0.6.1-manifest.md](../product/v0.6.1-manifest.md) · **v0.6.7 bench (L3):** [benchmarks/README.md](../../benchmarks/README.md#quick-update-v067-l3)

## Hypothesis

Reusing **classify + size** results when `abs_path` and `mtime_ms` are unchanged cuts repeat-scan wall time by ≥30% on trees with few edits, without increasing blocked-path incidents.

## v0.6.1 intervention

| Layer | Behavior |
|-------|----------|
| Storage | `path_inventory` SQLite table |
| Quick update | `scan_mode=quick` + `incremental_inventory_enabled` |
| Invalidation | Config fingerprint change; path missing after discover; mtime change |
| Full scan | Always re-classify; still refreshes inventory |

## Benchmark protocol

### Automated (CI)

```bash
pnpm benchmark:quick-update
```

Runs full → quick on a synthetic `node_modules` fixture; asserts ≥30% faster **classify+size** pipeline and ≥95% inventory reuse. See `benchmarks/baseline.quick-update.json`.

### Manual

1. Pick reference tree (≥200 candidates, mixed kinds).  
2. Run **Full scan** — record total time and phase timings from status.  
3. Run **Quick update** immediately — record total time; note `inventory_reused` in completion message.  
4. Change one large folder mtime — Quick update should re-work only that subtree’s targets.  
5. Compare blocked/safe counts vs step 2 — must match except for intentional edits.

## Promotion criteria (→ stable in 0.6.x)

- Quick update ≥30% faster than full on unchanged tree (same machine).  
- No new false-safe deletes in manual spot checks.  
- Setting can default to enabled after one release candidate cycle.

## Out of scope here

- Skipping discover walk (needs USN or dir mtime index).  
- Inventory shared across machines or users.
