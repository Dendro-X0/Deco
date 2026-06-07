# Scan contract changelog

All consumers (desktop UI, CLI `--json`, automation) should treat **`schema_version`** as the compatibility anchor.

Bump **`SCAN_REPORT_SCHEMA_VERSION`** in both:

- `apps/desktop/src-tauri/src/engine/types.rs` (`pub const SCAN_REPORT_SCHEMA_VERSION`)
- `apps/cli/src/scan-contract.ts` (`SCAN_REPORT_SCHEMA_VERSION`)

Update this file and `docs/schemas/scan-report.schema.json` in the same change.

## 1.0 stability policy (2026-05-29)

From **`v0.9.11`** through **`v1.0.0`**, keep **`schema_version` at `2.8.0`** unless a **breaking** wire change is unavoidable (field rename/removal, semantic change to existing fields). Additive, backward-compatible fields may ship in a minor contract bump with a changelog entry.

Non-breaking work (classification parity, docs, SECURITY.md) does **not** require a schema bump.

## 2.8.0 — 2026-05-17

- **Added** candidate kind: `bazel_disk_cache` (Bazel `--disk_cache` tree when **`BAZEL_DISK_CACHE`** points at an existing directory with `cas` and/or `ac` subdirectories; review tier + execute guard).
- **Added** scan/settings flag: `check_bazel_disk_cache` (default `false`).
- **Changed** walk discovery: Gradle/Android **`.cxx`** external native build output when a JVM/Gradle marker (`build.gradle`, `settings.gradle`, `gradlew`, …) exists on an ancestor (`balanced+`); classified as **review** by default.
- **Changed** path inventory fingerprint (`inventory_fingerprint` in `apps/desktop/src-tauri/src/engine/inventory.rs`) now includes `check_bazel_disk_cache` alongside other `check_*` discovery toggles — Quick update reuse only applies when this fingerprint matches the prior scan.
- **Bumped** `SCAN_REPORT_SCHEMA_VERSION` to `2.8.0`.

## 2.7.1 — 2026-05-18

- **Changed** walk discovery: Xmake `.build`, Premake `bin-int` / `obj`, Qt/qmake `build-*` shadow dirs when respective project markers are present (`balanced+`). No new candidate kinds.
- **Bumped** `SCAN_REPORT_SCHEMA_VERSION` to `2.7.1`.

## 2.7.0 — 2026-05-18

- **Added** candidate kinds: `vcpkg_installed_cache`, `conan_global_cache`, `ccache_global_cache`, `sccache_global_cache`.
- **Added** scan/settings flags: `check_vcpkg_cache`, `check_conan_cache`, `check_ccache`, `check_sccache` (default `false`, review tier + execute guard).
- **Changed** walk discovery: Bazel `bazel-*` output directories when `WORKSPACE` / `WORKSPACE.bazel` / `MODULE.bazel` is present (`balanced+`).
- **Bumped** `SCAN_REPORT_SCHEMA_VERSION` to `2.7.0`.

## 2.6.0 — 2026-05-15

- **Added** candidate kind: `composer_global_cache`.
- **Added** scan/settings flag: `check_composer_cache` (default `false`, review tier + execute guard).
- **Changed** walk discovery: MSVC-style `Debug` / `Release` (and variants) under `x64` / `Win32` / etc. when a CMake or `.vcxproj` project is present (`balanced+`; aggressive may match without arch parent).
- **Bumped** `SCAN_REPORT_SCHEMA_VERSION` to `2.6.0`.

## 2.5.0 — 2026-05-15

- **Added** candidate kinds: `cargo_registry_cache`, `bun_global_cache`, `nuget_global_cache`.
- **Added** scan/settings flags: `check_cargo_registry`, `check_bun_cache`, `check_nuget_cache` (default `false`, review tier + execute guard).
- **Changed** walk discovery: `cmake-build-*` and aggressive-profile `out/` dirs when `CMakeLists.txt` is present in the project tree.
- **Bumped** `SCAN_REPORT_SCHEMA_VERSION` to `2.5.0`.

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
