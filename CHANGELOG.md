# Changelog

## [Unreleased]

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
