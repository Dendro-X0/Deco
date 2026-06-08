# Scan contract schema audit

**Date:** 2026-05-29 · **Contract version:** `2.8.0` · **Auditor:** v1.0.0 prep (B2)

Compares [scan-report.schema.json](../schemas/scan-report.schema.json) to Rust `ScanResponse` / `CleanupCandidate` (`engine/types.rs`) and CLI `WireScanReport` (`scan-contract.ts`).

## Automated checks

```bash
pnpm -F @dendro-x0/deco-cli test scan-report-schema
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml schema_audit
```

## Findings (resolved)

| ID | Finding | Resolution |
|----|---------|------------|
| **S1** | Schema root `additionalProperties: false` but desktop emits `inventory_reused`, `discover_ms`, `classify_ms`, `size_ms` (v0.6.x) | Added optional root properties to schema |
| **S2** | `display_reason_summary` required in schema but Rust `Option<String>` may omit field (inventory reuse) | Removed from `required`; typed `string \| null` |
| **S3** | No CI guard against Kind enum drift | Added `scan-report-schema.test.ts` + `schema_audit.rs` |

## Aligned (no change)

| Area | Notes |
|------|--------|
| **Kind wire keys** | 28 kinds; schema enum ↔ `Kind::wire_key()` ↔ CLI `targetKindToWire` |
| **Risk / safety_class** | `safe` / `review` / `blocked`; five safety classes |
| **Envelope required fields** | `schema_version`, `scan_id`, `scanned_dirs`, `total_bytes`, `candidates`, `totals_by_risk`, `totals_by_kind`, `warnings` |
| **Candidate nullable fields** | `size_bytes`, `mtime_ms`, `project_root`, `stale_days` |
| **CLI-only `scan_options`** | Optional in schema; desktop omits |

## Intentional surface differences

| Field | Desktop | CLI |
|-------|---------|-----|
| `inventory_reused` | Set on quick update | Omitted |
| `discover_ms` / `classify_ms` / `size_ms` | Phase timings | Omitted |
| `scan_options` | Omitted | Included by default in `--json` |
| `display_reason_summary` | Usually set; may omit on inventory reuse | Always set in `buildWireScanReport` |

These are **documented optional** extensions, not wire-breaking drift.

## Maintenance

When adding a **Kind** or bumping **`SCAN_REPORT_SCHEMA_VERSION`**:

1. Update Rust `Kind` + `wire_key()` / `from_wire_key()`
2. Update CLI `KIND_TO_WIRE` in `scan-contract.ts`
3. Update schema `kind` enum
4. Run both schema audit test commands above
5. Entry in [changelog.md](changelog.md)

Parent: [v1.0.0-manifest.md](../product/v1.0.0-manifest.md) · [scan-contract.md](scan-contract.md)
