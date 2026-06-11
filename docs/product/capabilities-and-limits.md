# Capabilities and limits (honest commitments)

**Audience:** Developers evaluating or using Deco as lightweight OSS  
**Last updated:** 2026-06-11

Deco is a **safety-first cleanup and space-management** tool for developer machines. This document states what the project **commits to**, what it **does not promise**, and why — so expectations stay aligned with how Windows and real apps behave.

---

## What we commit to

### Cleanup core (primary product)

| Commitment | Detail |
|------------|--------|
| **Deterministic classification** | Only registered artifact kinds (`node_modules`, `target`, package caches, …) become delete candidates — no ML guessing. |
| **Risk tiers** | Every candidate is `safe`, `review`, or `blocked` with explainable reason codes. |
| **Quarantine-first** | Default path is reversible quarantine, not permanent delete. |
| **Explicit scope** | Scans run only on roots **you** select (partitions, project folders, custom paths). |
| **Cross-surface contract** | Desktop and CLI aim for aligned scan semantics per engine version ([scan contract](../contract/scan-contract.md)). |
| **Under-detect over over-delete** | We prefer missing edge cases to silently deleting the wrong tree ([PROJECT.md](../../PROJECT.md)). |

### Transparency (OSS trust)

| Commitment | Detail |
|------------|--------|
| **Open source** | Policy, engine, and UI are auditable in this repository. |
| **No telemetry by default** | Normal use does not upload your file tree or scan results ([README.md](../../README.md)). |
| **Documented limits** | Migration, scan scope, and Windows constraints are written down — not marketing footnotes. |
| **Honest UI** | Experimental or partial-success states are labeled (e.g. custom folder **copy-assist only**). |

### Tool storage migration — listed profiles (Windows adjunct)

| Commitment | Detail |
|------------|--------|
| **Tested paths** | Known profiles (Cursor, VS Code, Chrome, Discord, …) use fixed source layouts documented in [tool-migration-profiles.md](tool-migration-profiles.md). |
| **Plan before Run** | Size, paths, process checks, and warnings are shown before any copy. |
| **Audit trail** | Run writes a JSON audit log under Deco app data `migrations/`. |
| **Backup on success** | Original folder is renamed to `.deco-backup-*` on disk until you delete it after verification. |
| **Best-effort junction** | Listed profiles attempt copy → rename → `mklink /J` at the original path — the same model as a careful manual guide. |

**We do not claim listed migration is infallible.** Windows file locks, elevation, MSIX apps, and cross-volume edge cases can still fail. When they do, we document recovery (manual steps, audit log, backups).

---

## What we do not commit to

### No perfect relocation on Windows

There is **no perfect solution** for moving arbitrary data off `C:` such that:

1. **Nothing ever breaks** — apps, games, and Windows shell components assume path contracts Deco cannot rewrite.
2. **All future writes** automatically go to the new drive — until a junction or official redirect exists at the path the app opens, new files may still land on `C:`.
3. **One tool fixes a full small SSD** — bulk `AppData`, game saves, and launcher layouts need per-app or manual workflows.

Microsoft documents similar limits for relocating `Users` / `ProgramData` ([KB 949977](https://learn.microsoft.com/en-us/troubleshoot/windows-server/user-profiles-and-logon/relocation-of-users-and-programdata-directories)). Closed-source “disk managers” often hide junction dependencies that break on uninstall — Deco does not install a persistent system shim.

### Custom folder migration — explicit non-guarantees

When you enable **Custom folder** in Settings (or pass `--source` / `--dest` on the CLI with tool `custom`):

| We do | We do **not** do |
|-------|------------------|
| Plan (size, blocklist, warnings) | Automate rename of the source folder |
| Copy data to your destination | Create `mklink /J` at the original path |
| Show numbered manual finish steps after copy | Register the folder in managed migrations |
| Keep the destination copy if later steps fail | Guarantee the app will use the new location |

**Custom migration is copy-assist only — experimental.** There is no perfect custom migration in Deco or in Windows user space generally. See [custom-folder-migration-policy.md](custom-folder-migration-policy.md).

### Scan scope — not a full `C:` liberator

| Reality | Why |
|---------|-----|
| Scanning only `C:\` often finds **little** reclaimable space | Default roots target **project folders** (`Projects`, `dev`, `code`, …), not entire `AppData`. |
| Deco will not quarantine arbitrary profile bulk | Chat DBs, game saves, and opaque caches are outside the artifact whitelist by design. |
| Strong yields on `E:` / `G:` with active repos | Expected — cleanup targets **developer artifact trees** on roots you maintain. |

### Platform scope

| Feature | Windows | macOS / Linux |
|---------|---------|----------------|
| Cleanup scan + quarantine | Yes | Yes |
| Tool storage migration (junction) | Yes (NTFS) | Not offered in desktop UI |

---

## What works well outside Deco (we point you there)

These paths are **manual** or **OS/vendor-supported** — often better than any third-party “migrate everything” promise:

- **Documents relocation** — Properties → Location (e.g. The Sims 4 under `Documents\Electronic Arts`).
- **Per-tool settings** — npm/pnpm cache, `CARGO_HOME`, Docker disk, Steam library folder.
- **Larger system SSD** — still the least fragile fix for chronic `C:` pressure.

See [positioning.md](positioning.md) and [ide-storage-off-os-drive.md](../desktop/ide-storage-off-os-drive.md).

---

## How Deco communicates limits in the product

- **Settings → Tool storage migration** — platform badge, custom **Experimental · copy only** badge, policy banner, confirm dialog text.
- **Partial success** — copy completed without junction → manual steps in UI, no false “migration completed” toast.
- **Migration handoff banner** — suggests **listed** tools on low `C:` space, not custom bulk moves.
- **Docs linked from the app** — this file, custom policy, manual junction guide.

If marketing copy and behavior diverge, **behavior and this document win** — please file an issue.

---

## Summary for contributors and users

> **Deco commits to honest, scoped cleanup for developer artifacts and best-effort listed migration on Windows. It does not commit to perfect custom migration, full `C:` liberation, or guaranteed future write paths for arbitrary folders.**

When in doubt: scan and quarantine on project drives; use **listed profiles** for known AppData tools; use **Windows or manual junction guides** for games and Documents trees; upgrade `C:` when hardware allows.

---

## Related docs

- [positioning.md](positioning.md) — product role and tiers
- [custom-folder-migration-policy.md](custom-folder-migration-policy.md) — custom vs listed
- [safety.md](safety.md) — delete policy
- [PROJECT.md](../../PROJECT.md) — engineering north star
