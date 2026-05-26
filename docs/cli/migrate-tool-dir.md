## Migrate tool directories (Windows)

Deco can migrate certain large, high-churn tool directories off a constrained OS drive (usually `C:`) onto another drive (e.g. `D:`), while leaving behind a **directory junction** so the tool still works at its original path.

This is intended to prevent workflows where you repeatedly delete app/tool data to reclaim space (and lose history/settings/extensions).

### Safety model

- **Windows only (v0.9.0)**: migration uses NTFS directory junctions.
- **Plan first**: always run `plan` to validate paths and estimate size.
- **Rollbackable**: `run` copies to destination, renames the original as a backup, then creates the junction. If anything fails, it attempts to restore the original directory.
- **Explicit confirmation**: `run` requires `--yes`.

### Common usage (Cursor)

Plan the migration:

```bash
deco migrate-tool-dir plan --tool cursor --dest-root "D:/DevToolData"
```

Run the migration:

```bash
deco migrate-tool-dir run --tool cursor --dest-root "D:/DevToolData" --yes
```

JSON output:

```bash
deco migrate-tool-dir plan --tool cursor --dest-root "D:/DevToolData" --json
deco migrate-tool-dir run  --tool cursor --dest-root "D:/DevToolData" --yes --json
```

### Supported tool IDs (v0.9.0)

- `cursor`: `%APPDATA%\Cursor`
- `vscode`: `%APPDATA%\Code`
- `docker-desktop`: **plan-only** in v0.9.0 (Docker Desktop / WSL storage is more complex; automation is gated)

### Advanced usage (custom paths)

If a tool isn’t in the allow-list, you can specify explicit paths:

```bash
deco migrate-tool-dir plan --source "C:/path/to/source" --dest "D:/path/to/dest"
deco migrate-tool-dir run  --source "C:/path/to/source" --dest "D:/path/to/dest" --yes
```

Copy-only mode (does not create a junction; you delete the source manually later):

```bash
deco migrate-tool-dir run --tool cursor --dest-root "D:/DevToolData" --yes --copy-only
```

### Troubleshooting

- If the tool is running, files may be locked. Close the tool and re-run `run`.
- If `run` fails, check the printed **audit log** path for details.
- Docker Desktop migration is intentionally plan-only in v0.9.0; use `plan` to identify where the bytes are and follow Docker’s official guidance for moving its data.

