## Migrate tool directories (Windows)

> **Windows desktop:** Settings → **Tool storage migration** offers Plan + Run with a confirm dialog (v0.9.4+). Failures can still destroy profiles — always review the plan and quit the tool first. The [manual IDE storage guide](../desktop/ide-storage-off-os-drive.md) remains the fallback. CLI below is for scripting.

Deco can **attempt** to migrate certain large, high-churn tool directories off a constrained OS drive (usually `C:`) onto another drive (e.g. `D:`), while leaving behind a **directory junction** so the tool still works at its original path.

Failures can destroy profiles. Prefer manual steps in the guide when reliability matters more than automation.

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

### Supported tool IDs

See [tool-migration-profiles.md](../product/tool-migration-profiles.md) for the full table.

- `cursor`: **bundle** — `%APPDATA%\Cursor` + `%LOCALAPPDATA%\Cursor` in one Plan/Run (dest: `…/Cursor` and `…/Cursor-Local`)
- `cursor-roaming` / `cursor-local`: single-leg (advanced)
- `vscode`, `claude-code`, `codex-cli`: run supported
- `docker-desktop`, `npm-cache`, `pnpm-store`, `claude-desktop`: **plan-only**

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

