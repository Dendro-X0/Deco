# Scan contract changelog

All consumers (desktop UI, CLI `--json`, automation) should treat **`schema_version`** as the compatibility anchor.

Bump **`SCAN_REPORT_SCHEMA_VERSION`** in both:

- `apps/desktop/src-tauri/src/engine/types.rs` (`pub const SCAN_REPORT_SCHEMA_VERSION`)
- `apps/cli/src/scan-contract.ts` (`SCAN_REPORT_SCHEMA_VERSION`)

Update this file and `docs/schemas/scan-report.schema.json` in the same change.

## 2.4.0 — 2026-05-16

- **Added** candidate kind: `conda_pkgs_cache` (package cache only; `envs/` never targeted).
- **Added** scan/settings flag: `check_conda_pkgs_cache` (default `false`, review tier + execute guard).
- **Changed** `display_reason_summary` includes **Regenerate:** hints for global cache kinds (CLI wire + desktop).
- **Bumped** `SCAN_REPORT_SCHEMA_VERSION` to `2.4.0`.

## 2.3.0 — 2026-05-16

- **Added** candidate kinds: `yarn_global_cache`, `pip_global_cache`, `uv_global_cache`.
- **Added** scan/settings flags: `check_yarn_cache`, `check_pip_cache`, `check_uv_cache` (default `false`, review tier + execute guard).
- **Bumped** `SCAN_REPORT_SCHEMA_VERSION` to `2.3.0`.

## 2.2.0 — 2026-05-16

- **Added** candidate kinds: `npm_global_cache`, `pnpm_global_store`.
- **Added** scan/settings flags: `check_npm_cache`, `check_pnpm_store` (default `false`, review tier + execute guard).
- **Bumped** `SCAN_REPORT_SCHEMA_VERSION` to `2.2.0`.

## 2.1.0 — 2026-05-15

- **Added** candidate kinds: `python_artifact`, `python_venv`, `jvm_artifact`, `jvm_global_cache`, `dotnet_artifact`, `ide_global_cache`.
- **Bumped** `SCAN_REPORT_SCHEMA_VERSION` in Rust (`engine/types.rs`) and CLI (`scan-contract.ts`).
- **No breaking changes** to envelope field names; existing 2.0.0 consumers should ignore unknown `kind` values or bump their parser.

## 2.0.0 — 2026-05-15

- **Added** `schema_version` on `ScanResponse` / CLI wire envelope.
- **Aligned** `totals_by_kind` keys with artifact kind wire strings (`node_modules`, `build_artifact`, …) instead of `Debug`-style lowercase (`nodemodules`).
- **Formalized** JSON Schema: `docs/schemas/scan-report.schema.json`.
- **CLI `--json`**: emits the wire report (snake_case, `warnings`, optional `scan_options`) instead of the legacy camelCase `ScanReportV2` object.
