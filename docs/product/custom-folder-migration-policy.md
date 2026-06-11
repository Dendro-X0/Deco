# Custom folder migration policy

**Status:** Experimental · Windows only · copy-assist only  
**Last updated:** 2026-06-11

---

## Scope

This policy applies when the user selects **Custom folder** in Settings → Tool storage migration. It does **not** apply to **listed tool profiles** (Cursor, Discord, browsers, etc.), which use a separate, tested migration path.

macOS and Linux do not use NTFS directory junctions for this workflow; the desktop migration UI is **Windows-only** by design.

---

## What Deco promises

| Action | Listed profile | Custom folder |
|--------|----------------|---------------|
| Plan (size, path checks) | Yes | Yes |
| Copy data to destination | Yes | Yes |
| Rename source to `.deco-backup-*` | Best effort | **No** (manual) |
| Create `mklink /J` at original path | Best effort | **No** (manual) |
| Register in managed migrations | On full success | **No** |

Custom folder **Run** is **copy-assist only**. Deco does not attempt rename or junction automation for arbitrary paths.

---

## Why full automation is not offered for custom paths

1. **Windows kernel rules** — Renaming a directory fails while any handle is open on any file inside. Holders are often Explorer, Search Indexer, antivirus, Xbox/Game services, or background agents — not necessarily the game or app executable.

2. **Elevation** — `mklink /J` and sometimes `ren` require an elevated Command Prompt. Deco runs as a normal user session and cannot guarantee those steps succeed.

3. **No split-brain guarantee** — Until a junction exists at the original path, applications may continue creating files on `C:`. Partial copies, failed renames, or delayed junction creation can leave data in two places and break apps.

4. **No registry / launcher rewrites** — Some games and tools store absolute paths outside the migrated folder. A junction at the old path does not fix those cases.

5. **OS autonomy** — Windows treats profile and AppData paths as system-adjacent. User intent does not override open handles, ACLs, or service locks.

There is **no perfect solution** for relocating arbitrary data directories on Windows without user-operated elevated steps and ongoing verification.

---

## User workflow (custom)

1. **Plan** — Review size, blocked-path errors, and warnings.
2. **Copy to destination** — Deco copies files (same engine as profile migration copy phase).
3. **Finish manually** — Elevated `cmd`: rename source → `mklink /J` (see [ide-storage-off-os-drive.md](../desktop/ide-storage-off-os-drive.md)).
4. **Verify** — Launch the app/game; confirm reads/writes go through the junction.
5. **Reclaim space** — Delete the `.deco-backup-*` folder on `C:` only after stable use.

If copy fails, nothing on `C:` is renamed. If copy succeeds, the destination copy is **kept** even when later manual steps fail.

---

## Alternatives when custom assist is insufficient

- Use a **listed profile** when the tool matches (Cursor, Chrome, Discord, …).
- **Games under Documents** — e.g. The Sims 4 Mods/saves in `Documents\Electronic Arts\The Sims 4`: use Windows **Documents → Properties → Location**, or move that subfolder manually with `robocopy` + `mklink /J`. Generic tutorials apply; no game-specific migrator required.
- Relocate via **official config** (npm cache, `CARGO_HOME`, Docker disk location, Steam library folder, etc.) — see [ide-storage-off-os-drive.md](../desktop/ide-storage-off-os-drive.md).
- **Manual robocopy + junction** end-to-end without Deco Run.
- **Deco scan + quarantine** for regenerable caches on project roots — does not move entire app profiles or bulk `AppData`.

Product role summary: [positioning.md](positioning.md).

---

## CLI note

`deco migrate-tool-dir run --source … --dest …` with tool `custom` follows the same **copy-assist-only** policy in the desktop engine. Full junction automation via CLI for custom paths is likewise not a product guarantee.
