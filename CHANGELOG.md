# Changelog

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
