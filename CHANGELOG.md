# Changelog

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
