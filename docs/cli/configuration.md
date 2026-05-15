# Configuration

## Repo config file

Optional: `.deco/disk-cleanup.json` under each scan root (desktop merges per-root + cwd; CLI uses `--config <path>`).

Schema: [`apps/cli/config.schema.json`](../../apps/cli/config.schema.json)  
Example: [`apps/cli/config.example.json`](../../apps/cli/config.example.json)

Typical keys:

- `roots`, `maxDepth`, `staleDays`, `profile`
- `excludeAbsPathContains`, `extraProtectedPathContains`, `allowPathContains`
- `additionalDirNames` — extra build/rust/go/playwright directory names
- `quarantine.root`, `quarantine.retentionDays`

Invalid JSON fails fast with an actionable error (CLI + desktop).

## Desktop settings

Persisted via `get_settings` / `save_settings` (SQLite). UI: **Settings** tab.

Ecosystem toggles mirror CLI flags (`check_go_cache`, `check_jvm_global_cache`, etc.).

## Deterministic merge

Multiple config layers are merged with **sorted union** for list fields (excludes, safety paths, extra dir names). See [Milestone 3](../milestones/milestone-3.md).
