# Features

Deco v0.3 is designed to be fast, safe, and practical for scanning large developer disks.

## Safety

- Risk engine: every candidate is classified as `safe`, `review`, or `blocked`.
- Protected-path policy: system and app-runtime paths are blocked before deletion.
- Quarantine-first default: deletion moves targets into quarantine with restore IDs.
- Node modules guardrails:
  - must be in a validated project
  - must pass stale threshold (`--stale-days`, default `45`)
  - otherwise downgraded to `review` or `blocked`
- `blocked` targets are never deleted.

## Performance

- Parallel scanning with a bounded task queue.
- Parallel deletion execution.
- Optional `--no-size` for fast path-only scans.
- Early path pruning for protected trees to avoid expensive traversal.

## Profiles

- `safe`: conservative defaults.
- `balanced`: includes configured extra artifact directory names.
- `aggressive`: broader cache/temp heuristics while keeping hard protections.

## Deletion Modes

- `quarantine` (default): reversible and safest.
- `recycle-bin`: currently falls back to quarantine.
- `hard-delete`: permanent removal.

## CLI UX

- Interactive TUI groups by risk and kind.
- Safe candidates are selected by default.
- Review candidates require explicit second confirmation.
- Blocked candidates are visible but non-selectable.
- JSON output available for automation (`--json`).

## Quarantine Workflow

1. Delete in quarantine mode.
2. Capture generated quarantine IDs.
3. Restore with `--restore <id>`.
4. Purge old quarantined items with `--purge-quarantine --yes`.