# Features

Deco is designed to be a fast, safe, and modern disk cleanup tool for developers.

## 🚀 Performance
- **Parallel Scanning**: Uses a custom task queue to scan directories in parallel, making it significantly faster than sequential scanners.
- **Concurrency**: Defaults to 32 concurrent file system operations.
- **Skip Size Calculation**: Use the `--no-size` flag to skip expensive directory size calculations for near-instant results.

## 🛡️ Safety
- **Dry-Run by Default**: Unless you explicitly confirm deletion, Deco will only show you what *would* be deleted.
- **Interactive Handling**: In interactive mode, you must explicitly confirm your selection before any files are touched.
- **Timeouts**: Size calculations have a safety timeout (30s) to prevent the tool from hanging on network drives or problematic folders.

## 🛠️ Configuration
- **Config File**: Deco automatically loads settings from `.deco/disk-cleanup.json` in the current directory.
- **Ignore Rules**: Use `excludeAbsPathContains` to blacklist specific directories (e.g., monorepo submodules or system folders).

## 📦 Supported Targets

### Node.js
- `node_modules`
- `dist`, `build`, `.next`, `.svelte-kit`, `.astro`, `.cache`

### Rust
- `target`
- `.cargo-target`

### Go
- `bin`, `dist`, `build`
- **Global Caches**: Use `--check-go-cache` to scan and clean `GOCACHE` and `GOMODCACHE`.

### Playwright
- `test-results`
- `playwright-report`
