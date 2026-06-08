# Scan contract (JSON)

Deco exposes a **versioned** scan payload so the desktop app and CLI can share tooling, CI checks, and documentation without ad-hoc shapes.

## Where it lives

| Artifact | Path |
|----------|------|
| JSON Schema (Draft 2020-12) | [scan-report.schema.json](../schemas/scan-report.schema.json) |
| Version constant (Rust) | `SCAN_REPORT_SCHEMA_VERSION` in `apps/desktop/src-tauri/src/engine/types.rs` |
| Version constant (CLI) | `SCAN_REPORT_SCHEMA_VERSION` in `apps/cli/src/scan-contract.ts` |
| Changelog | [changelog.md](changelog.md) |

## Surfaces

- **Desktop**: `scan_roots` Tauri command returns `ScanResponse` JSON (includes `schema_version`).
- **CLI**: `deco --json …` prints the same envelope, plus optional **`scan_options`** (roots, profile, flags used) for reproducibility.

## Desktop extensions (optional on wire)

The desktop `ScanResponse` may also include timing and quick-update fields not present in CLI output:

| Field | Since | Meaning |
|-------|-------|---------|
| `inventory_reused` | v0.6.1 | Candidates reused from path inventory on quick update |
| `discover_ms` | v0.6.4 | Discovery phase wall time (ms) |
| `classify_ms` | v0.6.4 | Classification phase wall time (ms) |
| `size_ms` | v0.6.4 | Sizing phase wall time (ms) |

All are optional in [scan-report.schema.json](../schemas/scan-report.schema.json). Schema parity is checked in [schema-audit.md](schema-audit.md).

## Risk tiers (`risk` field)

| Value | Meaning | Execute / delete policy |
|-------|---------|-------------------------|
| `safe` | Regenerable / policy-clear targets under project rules (e.g. stale `node_modules`). | Allowed when user selects them (subject to delete mode). |
| `review` | Possibly reclaimable but needs judgment (e.g. fresh `node_modules`, unknown artifact heuristics). | Desktop: extra confirmation; CLI: requires `--include-review` for delete flows. |
| `blocked` | Never delete (protected paths, `node_modules` outside a detected project, policy blocks). | Must not be deleted; `can_delete` is `false`. |

Hard-delete and global-cache rules are unchanged from the product safety model (`PROJECT.md`).

## Classification parity note

The **TypeScript CLI** and **Rust desktop** classifiers are separate code paths today. The contract guarantees **compatible JSON**, not yet bit-identical risk output for every tree. Converging logic or sharing one engine is a follow-up goal.
