# Deco product positioning

**Last updated:** 2026-06-11

Canonical honesty pledge: **[capabilities-and-limits.md](capabilities-and-limits.md)** (what we commit to / what we do not promise).

---

## What Deco is

Deco is a **convenient cleanup and space-management tool** for developer machines:

- **Scan** project and drive roots you choose for classified, regenerable waste (`node_modules`, build outputs, package caches).
- **Review** risk tiers (`safe`, `review`, `blocked`) before anything is removed.
- **Quarantine-first cleanup** with restore and purge — not blind deletion.
- **Free-space planner** to hit a target GB from safe candidates.

That loop is the **primary product**. It works best on drives where active projects live (often `D:`, `E:`, `G:`). A cramped **`C:`** with dev work already moved elsewhere may show little reclaimable space — that is expected, not a failure of the engine.

---

## What Deco is not

- A general **“move everything off C:”** utility.
- A replacement for a **larger system SSD** (still the most reliable fix for chronic `C:` pressure).
- A guaranteed relocator for **arbitrary game saves**, entire `AppData`, or closed-source “disk manager” semantics.

See [why Windows resists bulk relocation](../desktop/ide-storage-off-os-drive.md) and [custom-folder-migration-policy.md](custom-folder-migration-policy.md).

---

## Tool storage migration (Windows adjunct)

**Listed tool profiles** (Cursor, VS Code, Chrome, Discord, browsers, utilities) use a **tested Plan → Run** path: copy, rename source to `.deco-backup-*`, create an NTFS directory junction at the original path.

| Tier | Examples | Deco role |
|------|----------|-----------|
| **Listed profiles** | Cursor, Chrome, Discord, Slack | **Reliable default** — same model as a careful manual `robocopy` + `mklink /J` guide |
| **Custom folder** | Game saves under `AppData`, one-off paths | **Copy-assist only** — junction steps are manual |
| **Game / Documents data** | The Sims 4 Mods, saves under `Documents` | **Manual** — use Windows or per-game workflow (below); not a listed profile |

macOS and Linux do not use this junction workflow; migration UI is **Windows · NTFS** only.

---

## Game and Documents data (manual — proven outside Deco)

Many games store large trees under **`Documents`** (not `AppData`). A common, successful pattern — including tens of GB for titles like **The Sims 4** — does **not** require a game-specific tool:

1. **Redirect the whole Documents folder** — Right-click **Documents** → **Properties** → **Location** → move to `D:\Documents` (or similar). Windows integrates the new path; new saves land there. This is Microsoft’s supported model ([Folder Redirection](https://learn.microsoft.com/en-us/windows-server/storage/folder-redirection/folder-redirection-rup-overview)).

2. **Or move only a heavy subfolder** — e.g. `Documents\Electronic Arts\The Sims 4` → copy to `G:\Games\Sims4`, then `ren` + `mklink /J` at the original path (elevated Command Prompt). Generic junction tutorials apply; the game does not need its own guide if it reads/writes under Documents.

3. **Steam / Epic library** — use the launcher’s **install location** setting for game binaries; saves may still live under `Documents` or `%LOCALAPPDATA%` — relocate those separately.

Deco **custom folder** mode can **copy** a specific subfolder (e.g. `...\The Sims 4\Mods`) to another drive; you finish rename + junction manually. For Documents-scale moves, Windows **Location** tab is often simpler than any third-party app.

---

## Practical guidance for users with a small `C:` SSD

| Priority | Action |
|----------|--------|
| 1 | **More `C:` capacity** when affordable — least fragile long term |
| 2 | **Deco scan** on drives with active projects — ongoing maintenance |
| 3 | **Listed migration** for known AppData hogs (Chrome, Cursor, …) |
| 4 | **Documents / launcher settings** for games and media libraries |
| 5 | **Manual junction** or Deco copy-assist for one-off folders you understand |

---

## Related docs

- [user-guide.md](../desktop/user-guide.md) — cleanup flow and Settings
- [custom-folder-migration-policy.md](custom-folder-migration-policy.md) — custom vs listed migration
- [tool-migration-profiles.md](tool-migration-profiles.md) — profile table
- [ide-storage-off-os-drive.md](../desktop/ide-storage-off-os-drive.md) — manual junction guide
