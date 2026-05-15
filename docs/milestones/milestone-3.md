# Milestone 3 — Repo config + excludes parity

## Goal

Optional `.deco/disk-cleanup.json` under each scan root (and cwd), plus `--config`, with deterministic merge, schema validation, and **excludes honored the same way in CLI and desktop**.

## What shipped

### File location and merge

- **Desktop (Rust)**: For each resolved scan root, reads `.deco/disk-cleanup.json` if present; also reads `cwd/.deco/disk-cleanup.json` once. Merges (union, sorted) into scan options:
  - `excludeAbsPathContains`
  - `safety.extraProtectedPathContains`
  - `safety.allowPathContains`
  - `additionalDirNames` (playwright / rust / go / build extras)
- **CLI (TS)**: `--config path.json` loads one file; optional keys; defaults match CLI when omitted. Repo-relative `.deco/disk-cleanup.json` is not auto-discovered in the CLI (use `--config` or put paths in config `roots`).

### Schema

- `apps/cli/config.schema.json`: `roots`, `maxDepth`, and `targets` are optional; `{}` is valid (overlay-only).
- Invalid unknown top-level keys still fail fast (CLI).

### Parity

- Excludes from merged layers are passed into `PathPolicy` and `discover_targets` on the desktop path, matching CLI classifier behavior for substring checks on absolute paths.

## How to try it

**CLI**

```bash
pnpm -F @dendro-x0/deco-cli exec deco -- scan --config ./my-config.json --root .
```

**Desktop**

Put `.deco/disk-cleanup.json` at a scan root or cwd; run a scan from the UI — merged excludes apply.

## Acceptance checklist

- [x] Optional repo config file + `--config`
- [x] Schema allows partial / overlay config
- [x] Deterministic merge (sorted union) for overlapping lists
- [x] Invalid config fails fast with actionable errors
- [x] Excludes honored consistently in CLI and desktop for the same file on disk
