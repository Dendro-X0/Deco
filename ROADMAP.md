# Roadmap — Deco

This roadmap is designed to be used when the tool is moved into a dedicated repository.

## Milestone 0 — Baseline CLI (done)

- Dry-run by default.
- Delete requires `--delete --yes`.
- Basic scanning across roots with `--max-depth`.
- Targets:
  - `node_modules`, common build outputs, Playwright artifacts
  - Rust build outputs (`target`, `.cargo-target`, `pkg`)

## Milestone 1 — Reliability + UX

### Deliverables

- Robust path handling for Windows.
- Clearer progress output:
  - scanned directories count
  - target count
- Better error reporting:
  - permission errors surfaced as warnings in report

### Acceptance criteria

- Can scan a drive root without crashing.
- Produces a stable report even if some folders can’t be read.

## Milestone 2 — Config + ignore rules

### Deliverables

- Optional config file `.deco/disk-cleanup.json`.
- Config schema:
  - roots
  - maxDepth
  - enabled target kinds
  - additional target directory names
  - exclude patterns
- `--config <path>` override.

### Acceptance criteria

- Config parsing is strict and validated.
- CLI merges config with CLI flags deterministically.

## Milestone 3 — Go support (project + global modes)

### Deliverables

- Project-local Go targets (optional): `bin/`, `dist/`, `build/`.
- Optional `--go-cache` mode that reports (and optionally cleans) global caches:
  - `go env GOCACHE`
  - `go env GOMODCACHE`

### Acceptance criteria

- Global cache cleaning is opt-in and separated from project scanning.

## Milestone 4 — Performance

### Deliverables

- Concurrency for size computation.
- `--no-size` mode (list targets only; fast).
- Optional cap on size traversal time.

### Acceptance criteria

- Can scan large roots with acceptable runtime.

## Milestone 5 — Packaging

### Deliverables

- Publishable package layout.
- `pnpm` scripts for build/test.
- GitHub Actions for CI.

### Acceptance criteria

- One-command build and a smoke test.
