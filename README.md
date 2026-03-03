# Deco (Developer Compact)

A fast, safety-first disk cleanup CLI for developer workstations.

Deco v0.3 uses a risk engine (`discover -> classify -> score -> plan -> execute`) instead of deleting by directory name alone.

## Highlights

- Risk-based cleanup: every candidate is scored as `safe`, `review`, or `blocked`.
- Quarantine-first deletion: default delete mode moves targets to quarantine with restore support.
- Safer `node_modules` cleanup: only considered safe when inside a validated project and stale.
- Root-drive scanning support: can scan partition roots like `E:/` while protecting system/app-runtime paths.
- Interactive dashboard: grouped by risk and kind with explicit confirmation for review-risk deletions.
- JSON output: machine-readable report with risk and reason codes.

## Quick Start

```bash
# Build
pnpm build

# Dry-run scan
node dist/cli.js --root "E:/" --profile safe

# Delete safe targets only (quarantine mode by default)
node dist/cli.js --root "E:/" --delete --yes

# Include review-risk targets explicitly
node dist/cli.js --root "E:/" --delete --yes --include-review

# Restore a quarantined item
node dist/cli.js --restore <quarantine-id>
```

## Safety Model

1. Hard path protection (system and app runtime locations) is applied before cleanup decisions.
2. Every target receives a risk level:
   - `safe`: eligible for deletion by default.
   - `review`: excluded unless `--include-review` is provided.
   - `blocked`: never deletable.
3. Default delete mode is `quarantine`, not hard delete.

## Profiles

- `safe` (default): conservative targeting and strict project evidence.
- `balanced`: includes additional configured artifact names.
- `aggressive`: broader candidate heuristics, still blocks protected paths.

## CLI Options

| Flag | Description |
|------|-------------|
| `--root <path>` | Root to scan (repeatable). Default: CWD |
| `--config <path>` | Config file override |
| `--max-depth <n>` | Scan depth limit (default `6`) |
| `--profile <safe\|balanced\|aggressive>` | Detection profile (default `safe`) |
| `--delete-mode <quarantine\|recycle-bin\|hard-delete>` | Deletion mode (default `quarantine`) |
| `--stale-days <n>` | Node modules stale threshold (default `45`) |
| `--delete` | Execute deletion (requires `--yes`) |
| `--include-review` | Include `review` risk candidates in deletion |
| `--yes` | Confirmation for destructive operations |
| `--restore <id>` | Restore quarantined item by ID |
| `--purge-quarantine` | Purge expired quarantine items (requires `--yes`) |
| `--json` | JSON report output |
| `--show-blocked` | Include blocked candidates in report |
| `--dry-run` | Non-interactive reporting mode |
| `--interactive` | Force TUI mode |
| `--no-size` | Skip size calculation |
| `--check-go-cache` | Include `GOCACHE` and `GOMODCACHE` |
| `--no-node-modules` | Disable node_modules targeting |
| `--no-build-artifacts` | Disable build artifact targeting |
| `--no-rust-artifacts` | Disable Rust artifact targeting |
| `--no-playwright-artifacts` | Disable Playwright artifact targeting |
| `--no-go-artifacts` | Disable Go artifact targeting |
| `-h`, `--help` | Show usage information |
| `-v`, `--version` | Show CLI version |

## Configuration

Default config path: `.deco/disk-cleanup.json`

```json
{
  "roots": ["E:/Projects"],
  "maxDepth": 6,
  "profile": "safe",
  "deleteMode": "quarantine",
  "staleDays": 45,
  "targets": {
    "nodeModules": true,
    "buildArtifacts": true,
    "rustArtifacts": true,
    "goArtifacts": false,
    "playwrightArtifacts": true
  },
  "excludeAbsPathContains": ["/monorepo/submodule"],
  "quarantine": {
    "root": "E:/.deco-quarantine",
    "retentionDays": 30
  },
  "safety": {
    "extraProtectedPathContains": ["/custom/runtime"],
    "allowPathContains": ["/test-fixtures/"]
  }
}
```

For more details, see [docs/features.md](docs/features.md).
