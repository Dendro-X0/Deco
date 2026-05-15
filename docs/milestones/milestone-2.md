# Milestone 2 — Shared scan contract (shipped)

Formal **versioned JSON** for scan results, shared naming between the **Rust `scan_roots`** response and **`deco --json`**.

## References

- Semantics & risk tiers: [scan-contract.md](../contract/scan-contract.md)
- JSON Schema (Draft 2020-12): [scan-report.schema.json](../schemas/scan-report.schema.json)
- Version history (bump checklist): [contract/changelog.md](../contract/changelog.md)
- Constants: `SCAN_REPORT_SCHEMA_VERSION` in `apps/desktop/src-tauri/src/engine/types.rs` and `apps/cli/src/scan-contract.ts` (must stay equal).

## Verify

```bash
pnpm -F @dendro-x0/deco-cli test
```

CLI smoke (wire JSON):

```bash
pnpm build:cli
pnpm dev:cli -- --dry-run --root . --max-depth 2 --no-size --json
```

Expect top-level keys: `schema_version`, `scan_id`, `scanned_dirs`, `total_bytes`, `candidates`, `totals_by_risk`, `totals_by_kind`, `warnings`, and optional `scan_options`.
