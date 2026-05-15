# Quickstart

## Desktop — guided cleanup (~5 minutes)

1. **Install** the desktop app ([Install](install.md)).
2. Open **Settings** → paste one or more project roots (one path per line) → **Save**.
3. Click **Free up space** (or **Scan Now** on the dashboard).
4. After the scan, review the table. Safe-tier rows are pre-selected.
5. Click **Clean selected…** → read the **preview** → confirm.
6. If you included **review-tier** items, check the box and type `DELETE REVIEW`.
7. Open **Quarantine** to restore anything you did not mean to remove.

More detail: [Desktop user guide](../desktop/user-guide.md).

## CLI — scan and dry-run

From a machine with Node 20+ and the CLI zip (or dev build):

```bash
# Scan only (default dry-run in non-interactive mode)
deco --root "C:\dev\my-monorepo" --max-depth 6 --no-size

# Machine-readable report
deco --root "C:\dev\my-monorepo" --json > scan.json

# Quarantine cleanup (requires --delete --yes)
deco --root "C:\dev\my-monorepo" --delete --yes --include-review
```

Repo config (optional): place `.deco/disk-cleanup.json` under a scan root — see [Configuration](../cli/configuration.md).

## What gets found?

Deco targets **developer artifacts**: `node_modules`, `target/`, build folders, ecosystem caches, etc. Classification depends on project markers (`package.json`, `go.mod`, `pyproject.toml`, …).

See [PROJECT.md](../../PROJECT.md) for the full target list and [Features](../product/features.md) for implemented commands.
