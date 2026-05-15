# Milestone 4 — Go + global cache story

## Goal

Project-local Go artifact directories only when a Go module signal is present, and **global Go caches** (`GOCACHE`, `GOMODCACHE`) as a separate, explicit opt-in path—never mixed into default repo scans.

## What shipped

### Project-local Go artifacts

- Directory names: `bin`, `dist`, `build`, `bin-win` (plus config `additionalDirNames.goArtifacts`).
- **Gated by `go.mod`**: `has_go_mod_ancestor` walks up to 6 parents (CLI + Rust).
- Generic `bin/` outside a Go module is **not** listed (avoids false positives on non-Go repos).
- `dist` / `build` under a Go module → `go_artifact`; without `go.mod` they remain `build_artifact` when JS/other build scanning applies.

### Global Go cache (opt-in)

- **CLI**: `--check-go-cache` runs `go env GOCACHE` / `GOMODCACHE` and adds `go_global_cache` candidates.
- **Desktop**: Settings → **Check global Go cache** (`check_go_cache`, default `false`) passed into `scan_roots`.
- **Classification**: global caches are **review** tier with `GLOBAL_CACHE_REQUIRES_OPT_IN` (not auto-selected as safe).
- **Deletion guard**: execute/delete skips `go_global_cache` unless the same opt-in was enabled (`check_go_cache` / `--check-go-cache`).

## How to try

**CLI**

```bash
pnpm build:cli
pnpm dev:cli -- --root ./my-go-service --max-depth 6
pnpm dev:cli -- --root . --check-go-cache --include-review --dry-run
```

**Desktop**

1. Settings → enable **Check global Go cache** → Save.
2. Run scan; global cache rows appear as review-tier if `go` is on PATH.
3. Cleanup requires review inclusion and the setting still enabled at execute time.

## Acceptance checklist

- [x] Project-local `bin` / `dist` / `build` only with Go module signal
- [x] Global cache via `go env GOCACHE` / `GOMODCACHE` when opted in
- [x] Defaults do not scan or delete global caches
- [x] Dedicated CLI flag and desktop settings toggle
