# Changelog

## [Unreleased]

Development line **v0.8.1** — see [v0.8.1-manifest.md](docs/product/v0.8.1-manifest.md).

## [0.8.0] - 2026-05-19

See [v0.8.0-manifest.md](docs/product/v0.8.0-manifest.md).

### Added

- **Multi-platform releases** — `release.yml` build matrix ships Windows (MSI/NSIS), macOS (dmg), and Linux (deb + AppImage) on every tag.
- **Per-OS CLI zips** — `deco-cli-win-x64`, `deco-cli-macos-aarch64`, `deco-cli-linux-x64` with `deco.cmd` / `./deco` launchers.

## [0.7.8] - 2026-05-18

See [v0.7.8-manifest.md](docs/product/v0.7.8-manifest.md).  
First GitHub Release after `v0.7.6`; bundles unpublished [0.7.7](docs/product/v0.7.7-manifest.md) work from `main`.

### Added

- **Workspace rollups** — dashboard **Workspace summary** card groups scan results by project root with safe/review/blocked subtotals; per-workspace checkbox selects safe items only.
- **README demos** — scan, cleanup, and settings GIFs under `docs/assets/demo/`.
- **Live cleanup progress** — overlay and status show **freed space** and **folders removed** while delete runs (updates as each tree finishes).
- **Cleanup results card** — dashboard shows post-cleanup analysis (freed bytes, counts, kinds removed) like scan statistics.

### Fixed

- **Parallel cleanup ordering** — bulk deletes now run **largest trees first** so chunked sessions (80+) do not defer multi-GB `node_modules` to the final chunk (fixes “fast first half, slow second half” wall time on SSD).
- **CI typecheck** — narrow live cleanup progress types for strict null checks on macOS/Ubuntu CI.

## [0.7.6] - 2026-05-18

See [v0.7.6-manifest.md](docs/product/v0.7.6-manifest.md).

### Added

- **Policy pack gallery** — five shipped examples (incl. Python and .NET packs); card grid and read-only JSON preview in Settings.
- **Replace preview** — top-level diff when applying over an existing `.deco/disk-cleanup.json`; **Reveal in Explorer** after apply.

## [0.7.5] - 2026-05-18

See [v0.7.5-manifest.md](docs/product/v0.7.5-manifest.md).

### Added

- **Classification parity (round 2)** — JVM, .NET, Python, and Go project artifacts; Electron runtime blocked path; `jvm-global-cache`, `cargo-registry-cache`, `ide-global-cache` in `cases.json`.
- **Project detection** — `detect_project_root` recognizes JVM, .NET, and Python markers (aligned with scanner ancestor checks).

## [0.7.4] - 2026-05-18

See [v0.7.4-manifest.md](docs/product/v0.7.4-manifest.md).

### Added

- **Policy pack (Settings)** — pick shipped examples or a folder, validate (CLI schema parity), preview, and write `.deco/disk-cleanup.json` into a project folder.
- **Classification parity** — `rust-artifact`, `python-venv`, and `go-global-cache` cases in `tests/fixtures/classification/cases.json`.
- **Roadmap** — version-ordered Phase D/E plan through `v0.8.4` ([v0.7.x-roadmap](docs/product/v0.7.x-roadmap.md), [v0.8.x-roadmap](docs/product/v0.8.x-roadmap.md)).

## [0.7.3] - 2026-05-18

See [v0.7.3-manifest.md](docs/product/v0.7.3-manifest.md).

### Added

- **Classification parity fixtures** — shared `tests/fixtures/classification/cases.json`; Vitest + Rust tests keep CLI and engine aligned.
- **CI automation docs** — [ci-automation.md](docs/cli/ci-automation.md) and `scripts/ci-scan-gate.mjs` for dry-run JSON scans and safe-tier reclaim gates.

## [0.7.2] - 2026-05-18

See [v0.7.2-manifest.md](docs/product/v0.7.2-manifest.md).

### Added

- **`deco validate-policy <path>`** — validate `disk-cleanup.json` policy packs (file, directory, or `.deco/` layout) against the CLI config schema; examples under `examples/deco-policies/`.

## [0.7.1] - 2026-05-18

See [v0.7.1-manifest.md](docs/product/v0.7.1-manifest.md).

### Added

- **Dormancy panel (candidate detail)** — explains stale vs recent using `stale_days`, classifier age, and settings threshold; surfaces `mtime_ms` from scan payloads.
- **Git dormancy hint (opt-in)** — Settings toggle runs `git log` when a candidate is selected (not during scan).
- **Sort by Stale** — candidate table column sorts by dormancy age (days).

## [0.7.0] - 2026-05-18

Opens **v0.7.x** trust/community track — see [v0.7.0-manifest.md](docs/product/v0.7.0-manifest.md).

### Added

- **Cleanup profiles (Settings)** — `first_scan`, `monorepo_maintainer`, and `ci_agent` presets bundle scan scope, safety profile, discovery flags, and scan strategy.
- **Regeneration hints (candidate detail)** — dedicated “Regenerate” panel with CLI/Rust parity for global-cache kinds; reason line strips embedded hint text.

## [0.6.12] - 2026-05-17

Closes the **v0.6.x** scan-engine line — see [v0.6.12-manifest.md](docs/product/v0.6.12-manifest.md).

### Added

- **Bazel disk cache (opt-in, review tier)** — when **`BAZEL_DISK_CACHE`** points at a directory with Bazel disk-cache layout (`cas` / `ac`); Settings + CLI `--check-bazel-disk-cache`; candidate kind `bazel_disk_cache`.
- **Gradle / Android `.cxx`** — external native build output under a Gradle/JVM marker tree (`balanced+`); classified **review** by default.
- **In-app update (Settings → Check for updates)** — match GitHub Release assets per OS (MSI/EXE, DMG/PKG, AppImage/DEB/RPM); download to the user Downloads folder and launch the system installer (best-effort on macOS/Linux; Windows MSI/NSIS built in CI).

### Changed

- **Scan contract `2.8.0`** — new kind `bazel_disk_cache`; flag `check_bazel_disk_cache`. Quick-update **inventory fingerprint** includes that flag (and existing `check_*` toggles). See [contract/changelog.md](docs/contract/changelog.md).

## [0.6.11] - 2026-05-18

### Added

- **Xmake / Premake / Qt builds** — `.build` (Xmake), `bin-int` / `bin-int64` (Premake), Premake `obj/` (when not a .NET tree), Qt shadow `build-*` dirs when `.pro` is present (`balanced+`). See [v0.6.11-manifest.md](docs/product/v0.6.11-manifest.md).

### Changed

- **Scan contract `2.7.1`** — discovery-only patch (no new candidate kinds). See [contract/changelog.md](docs/contract/changelog.md).

## [0.6.10] - 2026-05-18

### Added

- **Bazel output dirs** — `bazel-*` folders (e.g. `bazel-out`, `bazel-bin`) when `WORKSPACE`, `WORKSPACE.bazel`, or `MODULE.bazel` exists (`balanced+`).
- **Global native tool caches (opt-in, review tier)** — vcpkg `installed/`, Conan 2 `.conan2/p`, **ccache**, **sccache**; Settings toggles + CLI `--check-vcpkg-cache`, `--check-conan-cache`, `--check-ccache`, `--check-sccache`.
- **Scan contract `2.7.0`** — new kinds: `vcpkg_installed_cache`, `conan_global_cache`, `ccache_global_cache`, `sccache_global_cache`.

See [v0.6.10-manifest.md](docs/product/v0.6.10-manifest.md).

## [0.6.9] - 2026-05-18

### Added

- **C++ / native build discovery** — Meson `builddir` / `_build` when `meson.build` is present; CMake `out/` on `balanced+` (not aggressive-only); Visual Studio `.vs/` when `.vcxproj` / `.sln` markers exist (classified **review**). See [v0.6.9-manifest.md](docs/product/v0.6.9-manifest.md).

## [0.6.8] - 2026-05-18

### Added

- **Quick update recommendation** — after the first completed scan, dashboard banner and header button hint recommend Quick update for repeat scans (especially HDD); dismissible.
- **Check for updates** — Settings → Updates queries GitHub Releases for the latest tag and Windows installer assets; opens release notes and downloads in the browser.

### Fixed

- **CI Rust tests** — `cleanup_coalesce` normalizes `\` and `/` on all platforms; quick-update bench treats sub-millisecond pipeline timings as pass when inventory reuse is verified.

## [0.6.7] - 2026-05-18

### Added


- **Quick-update benchmark (L3)** — `deco-bench --quick-update` compares full vs quick scan on a synthetic fixture; `pnpm benchmark:quick-update` + CI; gates ≥30% faster classify+size pipeline and ≥95% inventory reuse (`benchmarks/baseline.quick-update.json`).
- **Fast dependency size estimate (L4)** — `fast_dependency_size_estimate` (default on): sampled sizing for `node_modules` / `target` / build trees; `~` prefix in UI; fewer 30s “Not calculated” timeouts; see [size-estimate.md](docs/experiments/size-estimate.md).
- **Batch delete UX (L5)** — cleanups with 80+ trees run in chunks of 40; cancel/pause honored between chunks; `chunk_boundary` progress shows per-chunk and overall throughput (`folders/min`, `MB/s`); see [batch-delete.md](docs/experiments/batch-delete.md).

### Docs

- **v0.6.7 release notes (L6)** — [v0.6.7-manifest.md](docs/product/v0.6.7-manifest.md) shipped; [experiments/README.md](docs/experiments/README.md) indexes L3–L5 docs; verification: `pnpm check`, `pnpm benchmark:scan`, `pnpm benchmark:quick-update`.

### Fixed

- **Project-group selection UI** — mixed safe/review groups no longer show a full green check when only safe items are auto-selected; partial state uses a minus (indeterminate) control; preview cleanup counts match the list.
- **Grouped results sorting** — project-grouped list restores clickable column headers (Risk, Project, Artifacts/kind, Total size) with sort indicators, same as flat list.

## [0.6.6] - 2026-05-17

### Added

- **Project-root grouping (L1)** — optional grouped results view: one row per project with artifact summary; expand to see paths; auto-enabled above 80 candidates; paginates by project on large scans.
- **HDD cleanup mode (L2)** — Settings → **Cleanup disk mode** (`auto` / `hdd` / `standard`): HDD deletes one tree at a time; **Pause** / **Resume** between folders; progress copy reflects sequential deletes; large-batch preview suggests HDD mode when still on auto.
- **`cleanup_disk_mode`** engine module — maps `auto` / `hdd` / `standard` to delete parallelism; `pause_cleanup` / `resume_cleanup` commands.

### Fixed

- **Candidate list layout** — fixed table columns so **Size** stays visible without horizontal scroll; long paths use `compactListPath` (full path on hover).

## [0.6.5] - 2026-05-17

### Added

- **Fast tree delete (experimental)** — `fast_tree_delete_enabled` (default on): in-place cleanup of `node_modules`, `target`, and build folders uses `rmdir /s /q` (Windows) or `rm -rf` (Unix) instead of per-file Rust removal; Settings → Safety.
- **Parallel in-place deletes** — bulk trees delete concurrently; worker count follows Scan behavior → Performance (`auto` / `low` / `high`); caps parallel deletes on huge batches (HDD-friendly).
- **Scan parallelism retuned** — `auto` uses 6 workers, `high` 8, `low` 2 (discover subtree split, classify/size batches, delete); parallel discover when a root has multiple immediate child folders (e.g. whole `G:\`).
- **Discover** — no longer walks inside `node_modules` / `target` interiors (avoids 50k+ useless directory visits).
- **Delete coalescing** — merges nested/duplicate paths before delete.
- **Cancel cleanup** — Stop cleanup button + `cancel_cleanup` command.
- **Large result lists** — default show 150 rows; optional pagination (200/page); cleanup timer updates every 250ms.
- **Smart discovery** (`smart_discovery_enabled`) — declarative walk patterns map path signals to registered kinds (Android Studio / JetBrains `caches` → IDE global cache when opted in).
- **`discovery_patterns`** module + experiment doc [smart-scan-strategy.md](docs/experiments/smart-scan-strategy.md).
- **`classify_parallel_threshold`** (Advanced, default 8) — tunes when rayon classify runs.

### Fixed

- **Scan progress phase** — UI no longer sits on “Classifying” during slow size walks; phase switches to **Size** before measuring, with throttled in-chunk updates; progress bar weights size ~55% of the bar (classify ~7%). Removed misleading “remaining in pipeline” classify text.
- **Discover skip logic** — “inside `target`/`node_modules`” checks respect the current walk root (fixes scans under `target/deco-bench-runs/` and benchmark regressions).

## [0.6.4] - 2026-05-17

### Added

- **Scan statistics card** on Dashboard after each scan — phase time bars, Quick update reuse %, top kinds by size.
- **Copy diagnostics** — clipboard snippet for support (scan id, timings, kinds, warnings).
- **`discover_ms` / `classify_ms` / `size_ms`** on `ScanResponse` returned with `scan-complete`.
- **`scan-statistics.ts`** helpers and tests; manifest `docs/product/v0.6.4-manifest.md`.

### Changed

- Status footer shows discover / classify / size breakdown when idle after a scan.

## [0.6.3] - 2026-05-15

### Added

- **Scan strategy presets** — `thorough`, `balanced`, `fast`, `background` (plus `custom` when tuning diverges) map to `max_depth`, `scan_concurrency_mode`, and `incremental_inventory_enabled`.
- **Settings UI** — strategy selector at top of Scan behavior; performance tuning grouped below.
- **Dashboard hint** — active strategy summary on Scan targets card.
- **`scan-strategy.ts`** with unit tests; manifest `docs/product/v0.6.3-manifest.md`.

### Changed

- Size calculation speed moved from Discovery into Scan behavior performance tuning.

## [0.6.2] - 2026-05-15

### Added

- **`deco-bench`** — headless scan pipeline benchmark on a synthetic Rust `target/` fixture; JSON output and `--compare` against `benchmarks/baseline.synthetic.json`.
- **`pnpm benchmark:scan`** — local/CI entry point with regression guard.
- **CI benchmark job** (Ubuntu) after Rust tests.
- Shared **`size_candidates_parallel`** in `engine/sizer.rs` (scan + bench).
- Manifest `docs/product/v0.6.2-manifest.md`.

### Fixed

- **`tauri dev`** — `default-run = "deco-desktop"` when `deco-bench` is present in the same crate.
- Benchmark fixtures use `target/deco-bench-runs/` (not `%LocalAppData%` paths pruned by path policy).

## [0.6.1] - 2026-05-15

### Fixed

- **Quick update** no longer fails with `UNIQUE constraint failed: candidates.id` — reused inventory rows get new candidate IDs per scan.

### Added

- **Incremental path inventory** (`path_inventory` SQLite table) — caches classify + size metadata per path and config fingerprint.
- **Quick update** scan — skips classify/size when `mtime` matches inventory; **Scan Now** remains a full rescan.
- **`incremental_inventory_enabled`** setting (default on) and manifest `docs/product/v0.6.1-manifest.md`.

### Changed

- Scan completion reports `inventory_reused` count in warnings and `ScanResponse`.

## [0.6.0] - 2026-05-15
### Added

- **Scan pipeline (v0.6.0)** — discover, then classify and size in 64-target chunks so candidates and sizes stream sooner on large drives.
- **Parallel classify** with `ProjectRootCache` memoization for project-root detection (`rayon` when chunk ≥ 8 items).
- **`scan_concurrency_mode`** setting: `auto` (default), `low` (HDD-friendly), `high` (SSD/NVMe) — tunes parallel folder size walks.
- **Phase timings** on `scan-progress`: optional `discover_ms`, `classify_ms`, `size_ms`; completion message includes per-phase breakdown.
- **Manifest & benchmark notes** — `docs/product/v0.6.0-manifest.md`, `docs/experiments/scan-performance.md`.

### Changed

- Size calculation uses adaptive concurrency plan from settings instead of a single fixed batch profile.
- **Scan targets** (partition vs custom folders, drive selection) live on the **Dashboard** only; Settings keeps profile, scan scope, discovery, and safety options.

## [0.5.7] - 2026-05-15

### Added

- **Composer global cache** (`check_composer_cache`) — `COMPOSER_CACHE_DIR` / `COMPOSER_HOME/cache` with `files/` or `repo/` marker; regen hint `composer clear-cache`.
- **MSVC native build outputs** — `x64/Debug`, `x64/Release`, etc. when CMake or Visual Studio project markers exist (`balanced+`).
- **Community policy examples** under `examples/deco-policies/` (monorepo, conservative, CI quick-scan).
- **Scan contract** `2.6.0`: kind `composer_global_cache`.
- **Delete permanently…** on the selection bar when default cleanup is quarantine — skips quarantine after an irreversible confirmation (safe-tier only; review-tier items are skipped).
- **Two-step scan stop** — **Stop scan** ends directory search only; **Stop analysis** ends classify/size work; header stays aligned with other actions.

### Changed

- Path policy blocks Visual Studio / Windows Kits toolchain paths under Program Files.
- **Cleanup progress** — elapsed timer, stage-specific messages (especially `node_modules`), completion time in status, and overlay detail text.
- **After cleanup/scan** — reclaimable totals and partition free-space refresh automatically (no manual page reload).
- **Partial scan sizing** — canceled or timed-out size walks show **Not calculated** (not `0.00 B`); only confirmed empty dirs show zero.

### Fixed

- **Cleanup no longer freezes the UI** — delete/quarantine runs on a background thread with progress events; main content is shielded while cleanup runs.
- **Freed space stat** — uses backend `freed_bytes` for successfully removed items (fixes doubled/wrong totals after cleanup).
- **Stop analysis** no longer errors with `scan not found` when the job already finished.

## [0.5.6] - 2026-05-15

### Added

- **Cargo registry cache** (`check_cargo_registry`) — `CARGO_HOME/registry` with `cache/` marker; regen hint `cargo cache -a`.
- **bun global cache** (`check_bun_cache`) — `BUN_INSTALL_CACHE_DIR` or `~/.bun/install/cache`.
- **NuGet global packages** (`check_nuget_cache`) — `NUGET_PACKAGES` or `~/.nuget/packages`.
- **CMake build trees** — `cmake-build-*` (balanced+) and `out/` (aggressive) when `CMakeLists.txt` is in the project tree.
- **Scan contract** `2.5.0`: kinds `cargo_registry_cache`, `bun_global_cache`, `nuget_global_cache`.

### Changed

- Settings **bun cache** is a real Discovery toggle (no longer “Soon” placeholder).

## [0.5.5] - 2026-05-15

### Added

- **Settings → Discovery**: categorized tabs (package managers, runtimes, IDE), **Select all / Clear all**, **Shift+click** range selection; bun cache placeholder.

### Fixed

- **Quarantine on macOS/Linux CI**: writable per-user quarantine base (not `/.deco-quarantine`); Windows-style `E:\` paths parsed before absolutize.
- **Discovery tab UI**: active tab ring no longer clipped by scroll container.

## [0.5.4] - 2026-05-15

### Added

- **Desktop Settings → Quarantine storage**: per-source-drive `{drive}\.deco-quarantine` (default) or a **custom folder** with browse; C: path warning when chosen.
- **Delete in place** remains the default delete mode (no quarantine disk use).

### Changed

- **Quarantine payloads** no longer default to `%AppData%`; they stay on the source drive or your chosen folder.
- **Cleanup UX**: release builds hide the console window; cleanup progress shows a dedicated phase; clearer post-cleanup toasts.
- When the disk is full, safe targets may fall back to **delete in place** instead of failing quarantine copy.

### Fixed

- Quarantine restore/list reliability after cleanup; same-drive rename avoids cross-volume copy failures (e.g. full E: with C: AppData quarantine).

## [0.5.3] - 2026-05-17

### Fixed

- **CLI**: Cap toolchain subprocess probes at 3s; skip `conda info --base` when `CONDA_PKGS_DIRS` is set (fixes Ubuntu CI timeout and hung scans without conda).

### Added

- Same as **0.5.2** (Conda pkgs cache, regeneration hints, scan contract `2.4.0`) — that tag did not ship installers due to CI; **0.5.3** is the first published release with those features.

## [0.5.2] - 2026-05-16

### Added

- **Conda pkgs cache** (`check_conda_pkgs_cache` / `--check-conda-pkgs-cache`) — discovers `pkgs` with `urls.txt` or `cache/` marker; never targets `envs/`.
- **Regeneration hints** in candidate `display_reason_summary` for global caches (e.g. `pnpm store prune`, `conda clean --all -p`).
- **Desktop Settings**: Conda pkgs cache toggle under Discovery.
- **Scan contract** `2.4.0`: kind `conda_pkgs_cache`.

## [0.5.1] - 2026-05-16

### Added

- **Yarn global cache** (`check_yarn_cache` / `--check-yarn-cache`) — Classic `v6` or Berry `berry/cache` markers; `yarn cache dir` when on PATH.
- **pip cache** (`check_pip_cache` / `--check-pip-cache`) — `PIP_CACHE_DIR` or defaults; requires `wheels` or `http` subdir.
- **uv cache** (`check_uv_cache` / `--check-uv-cache`) — `UV_CACHE_DIR` / `uv cache dir`; requires `archive-v0` or `downloads-v0`.
- **Desktop Settings**: Discovery toggles for Yarn, pip, and uv caches.
- **Scan contract** `2.3.0`: kinds `yarn_global_cache`, `pip_global_cache`, `uv_global_cache`.

## [0.5.0] - 2026-05-16

### Added

- **npm global cache** discovery (`check_npm_cache` / `--check-npm-cache`) — targets cache root with `_cacache` marker; review tier, opt-in execute.
- **pnpm store** discovery (`check_pnpm_store` / `--check-pnpm-store`) — respects `PNPM_STORE_PATH` and `pnpm store path`; requires `v3` store marker.
- **Desktop Settings**: toggles for npm cache and pnpm store under Discovery.
- **Scan contract** `2.2.0`: kinds `npm_global_cache`, `pnpm_global_store`.

### Changed

- **Docs**: Documented **whitelist + layered rules** scanning philosophy (no AI classification) in `PROJECT.md`.
- **Classifier**: Global package-manager caches are classified before path policy so AppData paths are not blocked as system paths.

## [0.4.11] - 2026-05-16

### Added

- **Desktop**: **Keyboard shortcuts** — `Ctrl+F` search, `Ctrl+Enter` scan, `Ctrl+Shift+L` clear filters, `?` / `Ctrl+/` help dialog.
- **Desktop**: **First-run onboarding** — welcome flow explaining scan → review → quarantine (stored in `localStorage`).
- **Desktop**: **Free Space Planner** — reclaim bar (safe/review segments + target marker), GB slider, and themed range control.

### Changed

- **Desktop**: Themed **scrollbars** (`.deco-scrollbar` + Radix `ScrollArea` thumbs) and custom **`NumberInput`** stepper replace native OS controls in modals, planner, and settings.
- **Desktop**: Results **size filter** — preset chips (≥100 MB, 100–500 MB, …) plus styled min/max range inputs and live summary.
- **Desktop**: Shared **`CandidateFilterBar`**; **`StatusFooter`** with scan phase badge, elapsed time, and app version (replaces dev build marker).
- **Desktop**: Scan progress shows phased status (Discover / Classify / Size / Done) in the footer.

## [0.4.10] - 2026-05-15

### Added

- **Desktop**: **Last scan** summary on Dashboard (links to History, reuse & scan again).
- **Desktop**: Floating **selection bar** when candidates are selected (count, size, clean, clear).
- **Desktop**: Dashboard **scan targets** use toggle tabs — **Disk partitions** (default) vs **Custom directories** — with only the active panel visible.

### Changed

- **Desktop**: Dashboard metrics show **`-.-- B`** and “No scan yet” until a scan completes; **`0.00 B`** only after a finished scan with nothing to reclaim.

### Fixed

- **Desktop**: **Reuse Config** from History restores custom-folder vs partition mode and saves settings before scanning.
- **Desktop**: History list shows candidate count and profile metadata.

## [0.4.9] - 2026-05-17

### Changed

- **Desktop**: **Settings** page refactor — exclusive scan mode UI (only active target editor shown), controlled form with reliable save of profile/thresholds/toggles, and clearer section layout.
- **Desktop**: **Quarantine** — History-style filters (search, size, time presets, drive), instant client-side filtering, purge confirmation, days-until-purge badges, Show in Explorer, and empty-state CTA.
- **Desktop**: Page-specific subtitles in the main header.
- **Desktop**: **Dashboard** shows a scan-target summary with **Edit in Settings** / **Quick adjust** (full picker lives in Settings and the pre-scan modal).
- **Desktop**: Disabled actions show hover tooltips (**Clean selected**, **Preview cleanup**, Settings save/discard, **Purge eligible**).

## [0.4.8] - 2026-05-17

### Added

- **Desktop**: **History** filters — size range, time presets (1 h / 24 h / 7 d / 30 d), and partition/drive.
- **Desktop**: Delete individual scan history records or **clear all** (with confirmation).

## [0.4.7] - 2026-05-17

### Added

- **Desktop**: **Custom folders** — scan only paths you specify (e.g. `G:\Web Development Project`) instead of a whole partition; much faster on HDDs.
- **Desktop**: **Scanning mode** selector — partition-based (SSD recommended) vs custom directories; inactive section is grayed out.
- **Desktop**: Custom folders UI — native **Browse folders** picker and a removable path list.
- **Desktop**: Candidate detail + planner sidebar stays visible while scrolling the results table (`sticky`).

### Fixed

- **Desktop**: Discovery uses ancestor-marker cache and gated project detection (fewer stat calls during HDD scans).

## [0.4.6] - 2026-05-16

### Added

- **Desktop**: **Show in File Explorer** on the candidate detail panel (opens the folder in Windows Explorer / Finder / xdg-open).
- **Desktop**: Candidate **search** (path/kind), **kind** dropdown (labels from scan results), and **size range** filters (e.g. `100MB`–`500MB`).

### Fixed

- **Desktop**: Table uses **single-column sort** only (click header to sort; click again to reverse).

### Changed

- **Desktop**: Removed multi-column sort stack (#1/#2) in favor of search + filter controls.

## [0.4.5] - 2026-05-16

### Added

- **Desktop**: Live elapsed timer in the footer during scan and cleanup.
- **Desktop**: Multi-column table sort (Shift+click column headers, e.g. Risk then Size).
- **Desktop**: Bottom-right toasts when scan/cleanup starts and when stop is requested.

### Fixed

- **CLI**: Quarantine purge with `retentionDays <= 0` on macOS (no longer skips items due to fresh `mtime`).

## [0.4.3] - 2026-05-16

### Added

- **Desktop**: Dashboard table sort — click **Risk**, **Kind**, **Path**, or **Size** headers (toggle asc/desc; default largest size first).
- **Desktop**: Rows and overview cards show **Sizing…** until the engine reports each candidate’s `size_bytes`; **0.00 B** only appears when sizing finished and the directory is empty.

## [0.4.1] - 2026-05-15

### Fixed

- **Desktop**: Candidate sizes and scan totals always computed on scan (no more all-zero byte rows from stale `include_size` off).
- **Desktop**: Status line shows scan wall-clock duration; sidebar status wraps instead of truncating long summaries.

### Changed

- **Desktop (Rust)**: Removed unused util modules and `thiserror` dependency; silenced `dead_code` warnings from orphan helpers.

## [0.4.0] - 2026-05-15

Monorepo desktop + CLI release (Milestones 4–8). Install from [GitHub Releases](https://github.com/Dendro-X0/Deco/releases) (Windows MSI/NSIS + CLI zip).

### Added

- **Desktop**: Tauri app with guided cleanup wizard, preview-before-quarantine, `DELETE REVIEW` for review-tier items, free-space planner, quarantine filter/bulk restore/audit export.
- **Engine**: Python / JVM / .NET / IDE ecosystem targets; scan contract **2.1.0**.
- **CLI**: Ecosystem flags, wire JSON parity with desktop; portable zip on release.
- **CI**: `ci.yml` (tests on PR/main); `release.yml` (Windows installers + CLI zip on `v*` tags).
- **Docs**: Encyclopedia layout under `docs/README.md`.

### Changed

- Repository layout: `apps/cli`, `apps/desktop`, `apps/frontend` (legacy root `src/` removed).
- Distribution: GitHub Releases only for end users (no npm publish path).

## [Unreleased]

### Progress Recorded (pre-0.4.0 snapshot)
- Milestone 8: desktop guided cleanup wizard, preview-before-execute modal, `DELETE REVIEW` confirmation, wired free-space planner, quarantine filter/bulk restore/audit export — see `docs/milestones/milestone-8.md`.
- Milestone 7: Python / JVM / .NET project artifacts with marker gating; global JVM + Xcode DerivedData opt-in; Python venv opt-in (review tier); scan contract 2.1.0 — see `docs/milestones/milestone-7.md`.
- Milestone 6: monorepo `test:all` / `build:desktop` / `package:cli`, GitHub Actions CI + Release (MSI/NSIS + CLI zip), removed broken npm/root-tauri workflows — see `docs/milestones/milestone-6.md`.
- Milestone 5: cancellable scan with partial results, parallel desktop sizing, 30s size timeout, walk pruning, `--no-size` / `include_size` fast path — see `docs/milestones/milestone-5.md`.
- Milestone 4: Go artifact dirs gated by `go.mod`, global `GOCACHE`/`GOMODCACHE` opt-in (`--check-go-cache` / desktop setting), review-tier global caches with execute guard — see `docs/milestones/milestone-4.md`.
- Milestone 3: optional `.deco/disk-cleanup.json` (desktop per-root + cwd merge), CLI `--config` with overlay schema, deterministic sorted union for excludes / safety lists / extra dir names, parity excludes in Rust `PathPolicy` + discover — see `docs/milestones/milestone-3.md`.
- Milestone 2: versioned scan JSON contract (`schema_version` 2.0.0), JSON Schema, CLI `--json` wire parity with desktop DTOs, `totals_by_kind` key fix — see `docs/contract/scan-contract.md` and `docs/contract/changelog.md`.
- Milestone 1 (reliability): symlink-safe scan + sizing, canonical target dedupe, surfaced walk/size warnings, duplicate-root dedupe, CLI phased progress — see `docs/milestones/milestone-1.md`.
- Milestone 0 baseline documented in `docs/milestones/milestone-0.md`; README updated for monorepo layout and verification commands.
- Build artifact scan: `dist-firefox/` aligned between CLI (`apps/cli`) and desktop Rust scanner (`apps/desktop/src-tauri`).
- Added project handoff status doc: `docs/product/status.md`.
- Confirmed desktop track as primary implementation path (Tauri + Rust + static UI).
- Confirmed safety-first behavior remains active:
  - quarantine default
  - blocked never deletable
  - review requires two-step confirmation + `DELETE REVIEW`

### Implemented This Cycle (Not Yet Tagged)
- Backend command/API expansion for preview, cancel, history, planner, quarantine filter, bulk restore.
- UI additions for detail drawer, preview gate, planner actions, scan history, quarantine filtering/bulk restore, error drawer.
- Streaming scan candidate updates and progress phase flow.
- Advanced-mode guard for hard-delete in backend + UI.
- Integration test coverage expanded and passing in current workspace.

### Notes For Next Session
- Run manual Windows UX validation and finalize release polish.
- Decide release version/tag for the desktop milestone after QA.

## [Desktop v0.2.0] - Safety + Clarity Milestone

### Added
- Cleanup preview command and modal gate before execute (`preview_execute`).
- Hard-delete advanced-mode guard (`advanced_mode=false` blocks hard-delete).
- Candidate detail panel (reason summary, reason codes, project root, stale days, full path).
- Streaming scan candidate batches (`scan-candidate-batch`) with phase progress.
- Scan cancellation command (`cancel_scan`).
- Scan history command + UI panel (`scan_history`).
- Quarantine filtering command + UI toolbar (`list_quarantine_filtered`).
- Quarantine bulk restore command (`restore_quarantine_bulk`).
- Free-space planner command + UI actions (`plan_free_space`).
- New settings fields:
  - `advanced_mode` (default `false`)
  - `default_target_gb` (default `10`)
- Additional backend command integration tests:
  - preview/execute parity
  - hard-delete guard
  - bulk restore success/failure reporting
  - cancel token behavior
  - history ordering

### Changed
- Review-risk flow now enforces two-step confirmation plus typed phrase (`DELETE REVIEW`) in desktop UI.
- Progress UX now reflects explicit phases (`discover`, `classify`, `size`, `done`) and streaming updates.
- Selection UX now supports persistent selection with `Select Only Safe` and `Select Visible`.

## [0.3.0] - Safety-First Redesign

### Added
- Risk-based cleanup pipeline: discovery, classification, scoring, and execution.
- New risk levels (`safe`, `review`, `blocked`) with reason codes in reports.
- Safer `node_modules` policy: only safe when project markers exist and directory is stale.
- New CLI options:
  - `--profile <safe|balanced|aggressive>`
  - `--delete-mode <quarantine|recycle-bin|hard-delete>`
  - `--stale-days <n>`
  - `--include-review`
  - `--json`
  - `--show-blocked`
  - `--restore <id>`
  - `--purge-quarantine`
- Quarantine workflow with manifest and restore support.
- New config fields: `profile`, `deleteMode`, `staleDays`, `quarantine`, `safety`.
- Test suite using Vitest for policy, classifier, config merge, integration scan, delete, and quarantine flows.

### Changed
- Default deletion mode is now `quarantine`.
- Non-interactive deletion deletes only `safe` targets unless `--include-review` is provided.
- Interactive dashboard groups by risk and prevents selecting blocked targets.
- Scanning logic moved to dedicated modules (`scan`, `path-policy`, `classifier`, `project-detection`).
- Desktop migration improvements:
  - live progress phases in UI (`discover`, `classify`, `size`, `done`)
  - stronger review confirmation flow with typed phrase (`DELETE REVIEW`)
  - persistent selection state with quick actions (`Select Only Safe`, `Select Visible`)
  - backend command integration tests for execute/restore/purge including review and blocked behavior

## [0.2.0] - Dashboard & Safety Update

### Added
- **Dashboard UI**: Redesigned TUI with real-time scanning progress, summary view, and action menu.
- **Smart Safety Filters**: Added strict exclusions for `resources/app` (Electron), `Program Files`, `AppData`, `Windows`, and `.vscode` to prevent accidental deletion of installed applications.
- **Parallel Deletion**: Deletion now runs concurrently (~32 items) for much faster performance.
- **Robustness**: Permission errors (EPERM/EBUSY) no longer crash the process; locked files are skipped with a warning.

### Changed
- **Removed**: Generic `bin` folders are no longer targeted as Go artifacts to reduce false positives.
- **Changed**: Interactive scan now shows a summary first instead of immediately listing all files.

## [0.1.0] - Milestone 5 Complete

### Added
- **Interactive TUI**: New default interactive mode using `@clack/prompts` for easier selection and deletion.
- **Performance**: Parallelized scanning and size calculation using a custom task queue.
- **Go Support**: Added support for cleaning Go build artifacts (`bin`, `dist`, `build`) and global caches (`GOCACHE`, `GOMODCACHE`).
- **Flags**:
    - `--interactive`: Force interactive mode.
    - `--dry-run`: Skip interactive mode and print a text report.
    - `--no-size`: Skip expensive size calculations for instant scanning.
    - `--check-go-cache`: enable checking for global Go caches.
- **Configuration**: Support for `.deco/disk-cleanup.json` configuration file.
- **Renamed**: Project renamed from `dcos-disk-cleanup` to `deco` (Developer Compact).

### Changed
- **Defaults**: Running without arguments in a TTY now enters interactive mode.
- **Optimization**: Size calculation now has a 30s timeout per directory to prevent hanging.
