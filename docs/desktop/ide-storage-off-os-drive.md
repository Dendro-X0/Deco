# Moving IDE and tool data off the OS drive (manual guide)

**Status:** Reference only. Deco does **not** guarantee results. Automated “one-click” migration was removed from the desktop app because Windows path contracts vary by tool and failures can destroy profiles.

Use this when `%APPDATA%` / `%LOCALAPPDATA%` folders (Cursor, VS Code, JetBrains, etc.) grow on a small **`C:`** volume.

---

## What Deco does instead

- **Scan** developer-regenerable waste (`node_modules`, build outputs, caches) on roots **you** choose—including profile paths if you add them as scan targets.
- **Quarantine / delete** only classified artifact kinds, with reasons and restore where supported.
- **Does not** replace CCleaner-style temp cleanup on `C:`.
- **Does not** reliably relocate entire IDE profiles. Prefer the manual flow below.

---

## Tools that relocate more easily

These expose a **configurable path** (environment variable or settings). Follow each product’s official docs.

| Tool | Typical approach |
|------|------------------|
| **npm** | `npm config set cache "D:\npm-cache"` |
| **pnpm** | `pnpm config set store-dir "D:\pnpm-store"` |
| **Docker Desktop** | Settings → Resources → disk / WSL data location (version-dependent) |
| **Rust** | `CARGO_HOME`, `RUSTUP_HOME` on another drive |
| **Go** | `GOPATH`, `GOCACHE` |

Success here does **not** mean Cursor/VS Code will behave the same way.

---

## Where IDEs usually store data (Windows)

| Tool | Roaming (settings, extensions, much state) | Local (caches, GPU cache) |
|------|---------------------------------------------|---------------------------|
| **Cursor** | `%APPDATA%\Cursor` | `%LOCALAPPDATA%\Cursor` |
| **VS Code** | `%APPDATA%\Code` | `%LOCALAPPDATA%\Programs\Microsoft VS Code` (install) + caches under Local |
| **JetBrains** | `%APPDATA%\JetBrains\<Product>` | `%LOCALAPPDATA%\JetBrains` |

Chat/history for Cursor often lives under `User\globalStorage` and `User\workspaceStorage` inside Roaming—**do not delete those folders** unless you intend to lose history.

---

## Manual junction migration (Windows, NTFS only)

**Not guaranteed.** Requires admin-capable `cmd`, enough free space on **both** drives during copy, and the app fully quit.

### Prerequisites

1. Destination drive is **NTFS** (e.g. `G:\DevToolData`).
2. **Quit** the IDE (Task Manager + tray). No `Cursor.exe` / `Code.exe` running.
3. **Back up** the source folder (copy to external disk or `G:\Backups\Cursor-YYYYMMDD`).
4. At least **2× folder size** free: on destination for the copy, on `C:` for rename/backup during the swap.

### Procedure (single folder)

Example: move Cursor Roaming from `C:` to `G:`.

1. Copy the folder (not move yet):
   ```cmd
   robocopy "%APPDATA%\Cursor" "G:\DevToolData\Cursor" /E /COPY:DAT /R:1 /W:1 /XJ
   ```
2. Verify `G:\DevToolData\Cursor` looks complete (spot-check `User` subfolders).
3. Rename the original (backup on `C:`):
   ```cmd
   ren "%APPDATA%\Cursor" "Cursor.deco-backup-YYYYMMDD"
   ```
4. Create a **directory junction** at the original path (elevated `cmd` if needed):
   ```cmd
   mklink /J "%APPDATA%\Cursor" "G:\DevToolData\Cursor"
   ```
5. Start the IDE. Confirm settings, extensions, and projects work.
6. After several days of stable use, delete `Cursor.deco-backup-YYYYMMDD` on `C:` to reclaim space.

Repeat for `%LOCALAPPDATA%\Cursor` → `G:\DevToolData\Cursor-Local` if that folder exists and is large.

### If something breaks

1. Quit the IDE.
2. Remove the junction: `rmdir "%APPDATA%\Cursor"` (removes the link only, not the target on `G:`).
3. Rename backup back: `ren "%APPDATA%\Cursor.deco-backup-YYYYMMDD" "Cursor"`.
4. Do not delete `G:\DevToolData\Cursor` until you are sure you do not need it.

### Common failures

| Symptom | Likely cause |
|---------|----------------|
| IDE acts like a fresh install | Junction wrong or points to empty/partial copy |
| “Access denied” on mklink | Need elevated terminal; path still in use |
| Verification / canonicalize errors | Cross-volume junction quirks; verify by opening the app, not only `dir` |
| Chat missing | Deleted `workspaceStorage` / `globalStorage` or moved without junction at original path |

---

## Freeing space without moving the profile

Often safer on a full `C:`:

1. **Temp:** `%TEMP%`, Settings → Storage → Temporary files.
2. **Cursor Local caches** (quit Cursor first): delete contents of `%LOCALAPPDATA%\Cursor\Cache`, `CachedData`, `GPUCache`, `Code Cache`, old `logs`.
3. **Old projects’ chat:** remove unused folders under `%APPDATA%\Cursor\User\workspaceStorage` (each hash folder is one workspace; read `workspace.json` for the path).
4. **Deco scan** on `C:\Users\<you>` with custom roots including `%LOCALAPPDATA%` for dev caches—not Roaming chat DBs.

---

## CLI (experimental, power users)

`deco migrate-tool-dir plan|run` remains in the CLI for scripting and testing. It is **not** supported as a product guarantee. See [migrate-tool-dir.md](../cli/migrate-tool-dir.md).

---

## When upgrading hardware is the right fix

If **`C:`** is under ~100 GB with Windows, games, and IDEs on the same volume, tools can only **delay** the crisis. A larger system SSD or moving games to another drive is often the only durable fix—this is a layout problem, not a failure of discipline.
