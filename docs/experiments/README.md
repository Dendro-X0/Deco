# Experiments

Optional spikes that may graduate into a [version roadmap](../product/version-roadmap.md) release. Each experiment should have its own markdown file here when work starts.

| Doc | Status |
|-----|--------|
| [scan-performance.md](scan-performance.md) | Manual + automated bench protocol (`pnpm benchmark:scan`) |
| [incremental-inventory.md](incremental-inventory.md) | Shipped — v0.6.1 quick update; v0.6.7 adds `pnpm benchmark:quick-update` (L3) |
| [size-estimate.md](size-estimate.md) | Shipped — v0.6.7 L4 dependency tree sampling (`fast_dependency_size_estimate`) |
| [batch-delete.md](batch-delete.md) | Shipped — v0.6.7 L5 chunked bulk delete + throughput progress |
| [smart-scan-strategy.md](smart-scan-strategy.md) | Shipped — v0.6.5 pattern registry |

**v0.6.7 bundle:** [manifest](../product/v0.6.7-manifest.md) · benches in [benchmarks/README.md](../../benchmarks/README.md) · `pnpm check` + `pnpm benchmark:scan` + `pnpm benchmark:quick-update`.

**Rules:** feature-flagged, fallback documented, benchmark or manual test note attached before promotion.
