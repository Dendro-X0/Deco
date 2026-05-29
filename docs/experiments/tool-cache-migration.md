## Tool cache directory migration (Windows)

**Goal:** allow Deco to migrate large, frequently-written tool directories (like `Cursor`, `npm`, `pnpm`, or language servers) off a constrained OS drive (e.g. `C:`) onto a larger data drive (e.g. `D:`), without breaking the tool or losing history.

This is motivated by setups where tools hard‑code or strongly prefer a path on the OS volume (such as `C:\Users\<user>\AppData\Roaming\Cursor`) and grow without bound. Deleting these folders frees space but destroys state (chat history, extensions, caches). Deco should provide a **safe "relocate + link" flow** instead of just delete.

### Target user story

- User has a small OS SSD with `C:` nearly full and a larger `D:` or `E:` drive.
- Heavy tool data lives under the user profile on `C:` (Cursor, package manager caches, language servers, IDE caches).
- User wants to:
  - Move that directory tree once to another drive.
  - Leave behind a junction/symlink so the tool still sees the original path.
  - Be able to undo or re‑run the migration safely.

### Scope (initial)

- **Platform:** Windows only for v0; specifically NTFS volumes where we can create directory junctions.
- **Surface:** CLI first (`deco migrate-tool-dir ...`); desktop UX relaunch in **v0.9.4** — see [v0.9.4-manifest.md](../product/v0.9.4-manifest.md).
- **Targets:** start with an explicit allow‑list of well‑known dev tools:
  - `Cursor` user data (e.g. `C:\Users\<user>\AppData\Roaming\Cursor`).
  - IDEs and editors (VS Code, JetBrains) caches/history where safe.
  - Package manager caches (npm, pnpm, yarn, Cargo, pip, etc.) when they are clearly regenerable.
- **Actions:**
  - Plan: dry‑run that shows source, proposed destination, size, and required free space.
  - Execute: copy/move data and create the link.
  - Verify: basic checks that the junction works and the tool directory is reachable.

Out of scope for v0:

- Cross‑machine migrations.
- Automatic detection of every arbitrary junction already present on the system.
- Non‑NTFS or network volumes.

### High‑level design

#### 1. Migration primitives (Rust, reused by CLI)

Add a small native module (Windows‑only) providing:

- `plan_migration(source: PathBuf, dest_root: PathBuf) -> MigrationPlan`
  - Resolves `source`, validates it is a directory on NTFS.
  - Picks `dest = dest_root.join(relative_name)` where `relative_name` defaults to the last segment (`Cursor`).
  - Computes approximate size (reuse existing sizing helpers).
  - Checks that `dest` is not a parent/child of `source` and that `dest` is not already a junction target (unless `--reuse` is supplied).
- `execute_migration(plan: &MigrationPlan, mode: CopyOrMove) -> MigrationResult`
  - Creates `dest` parent directories as needed.
  - Uses robust file copy (ideally via `robocopy`‑equivalent logic or existing Deco traversal) with retry and progress callbacks.
  - On success, renames `source` to `source.backup-<timestamp>` and creates an NTFS directory junction at `source` pointing to `dest`.
  - If junction creation succeeds, deletes the backup; if it fails, rolls back by restoring the original folder.

Notes:

- Prefer **directory junctions** (`CreateSymbolicLinkW` with directory flags, or `CreateSymbolicLink` + fallback) over traditional symlinks because they do not require Developer Mode / elevated privileges in the same way and behave well for tool data.
- Keep all operations **inside the user profile** (no `C:\Windows` etc.) to avoid elevation where possible.

#### 2. CLI UX (`deco` command)

Add a new subcommand family:

- `deco migrate-tool-dir plan --tool cursor --dest-root D:\DevCaches`
  - Looks up known source path(s) for the tool (e.g. Cursor’s Roaming profile path).
  - Prints a JSON/pretty summary:
    - Source path
    - Proposed destination
    - Size estimate and file count
    - Required free space vs available at destination
- `deco migrate-tool-dir run --tool cursor --dest-root D:\DevCaches`
  - Runs the migration primitive.
  - On success, prints a short report and the location of an audit log.

For power users:

- `--source` and `--dest` flags to override source/dest completely for custom tools.
- `--copy-only` to copy and create a junction without deleting the original (user manually deletes later).

#### 3. Safety & auditability

- Always require **explicit confirmation** for destructive steps when the tool is not one of the built‑in allow‑listed tools.
- Write a small JSON log per migration under Deco’s own data folder with:
  - timestamps, user, source, dest, junction kind
  - counts of files/bytes moved
  - any warnings or skipped entries.
- Detect and warn when the destination drive is the OS drive (migration would be a no‑op for space).
- Explicitly block:
  - system folders (`C:\Windows`, `C:\Program Files`, etc.).
  - arbitrary roots like `C:\` or profile root.

#### 4. Integration with scans

Longer‑term, Deco scans could:

- Recognize known tool directories on constrained drives as **“migration candidates”** instead of pure delete candidates.
- Present an alternate action: **“Move off C: and link”** that shells out to the CLI migration command (or a Tauri command on desktop).
- After a successful migration, downgrade or remove those paths from future cleanup suggestions.

### Cursor‑specific notes

For Cursor on Windows, the default Roaming path is typically:

- `C:\Users\<user>\AppData\Roaming\Cursor`

The initial migration recipe would be:

1. Plan: estimate size and choose destination like `D:\DevToolData\Cursor`.
2. Copy all contents from the Roaming `Cursor` directory to the destination.
3. Rename the original folder as a backup.
4. Create a directory junction at the original path pointing to the new location.
5. Verify that Cursor can start and see existing history; if so, delete the backup to reclaim C: space.

Deco’s implementation should wrap this flow with progress, logging, and rollback to make it safe for non‑experts.

### Open questions

- How much of this lives **only** in the CLI vs a first‑class desktop UX?
- Should we maintain a central registry of "managed migrations" so Deco can later **undo** or **re‑target** them?
- How aggressive should we be about suggesting migrations during normal scans vs only when the OS drive falls below a free‑space threshold?

