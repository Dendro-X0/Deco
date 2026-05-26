# CLI usage

The CLI lives in `apps/cli`. After build, invoke via `node dist/cli.js` or packaged `deco.cmd`.

## Common commands

```bash
# Help and version
deco --help
deco --version

# Scan (dry-run default when non-interactive)
deco --root /path/to/repos --max-depth 6 --no-size

# JSON wire report (schema_version 2.x)
deco --root . --json

# Delete via quarantine (requires --yes)
deco --root . --delete --yes

# Include review-tier targets
deco --root . --delete --yes --include-review

# Global caches (opt-in)
deco --check-go-cache --include-review --dry-run --root .

# Restore / purge quarantine
deco --restore <quarantine-id> --root .
deco --purge-quarantine --yes --root .

# Migrate large tool directories off C: (Windows)
deco migrate-tool-dir plan --tool cursor --dest-root "D:/DevToolData"
deco migrate-tool-dir run  --tool cursor --dest-root "D:/DevToolData" --yes
```

## Ecosystem flags (M7+)

| Flag | Effect |
|------|--------|
| `--no-python-artifacts` | Skip Python project dirs |
| `--include-python-venv` | Discover `venv` / `.venv` (review) |
| `--no-jvm-artifacts` | Skip JVM project `build/` |
| `--check-jvm-global-cache` | `~/.m2`, `~/.gradle/caches` |
| `--no-dotnet-artifacts` | Skip `bin/` / `obj/` |
| `--check-ide-global-cache` | Xcode DerivedData |

## Profiles and delete modes

- `--profile safe|balanced|aggressive`
- `--delete-mode quarantine|recycle-bin|hard-delete` (quarantine default)

## Development

```bash
pnpm build:cli
pnpm dev:cli -- --dry-run --root . --max-depth 4
pnpm -F @dendro-x0/deco-cli test
```

See [Configuration](configuration.md) for repo-level JSON policy.
See [Migrate tool directories](migrate-tool-dir.md) for the Windows junction-based migration flow.

## CI automation

Dry-run scans, JSON reports, exit codes, and a reclaim threshold example: [ci-automation.md](ci-automation.md).
