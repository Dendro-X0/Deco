# Desktop user guide

## Main areas

| Tab | Purpose |
|-----|---------|
| **Dashboard** | Scan results, selection, candidate detail, free-space planner |
| **Quarantine** | Restore, bulk restore, purge, audit export |
| **History** | Past scans; **Reuse Config** reruns with same roots/profile |
| **Settings** | Roots, profile, sizing, ecosystem opt-ins |

## Recommended flow: Free up space

1. **Free up space** (header) — guided wizard: welcome → scan → results.
2. Safe-tier items are pre-selected; adjust checkboxes if needed.
3. **Continue to preview** or **Clean selected…** on the dashboard.
4. **Preview cleanup** modal — confirm safe/review breakdown.
5. For review-tier rows: enable **Include review-tier** and type `DELETE REVIEW`.
6. **Quarantine selected** — files move to quarantine (not permanent delete).

## Workspace summary (monorepos)

After a scan, when Deco finds **two or more projects** and enough candidates, a **Workspace summary** card appears above the results list.

- Each row is one **project root** (from markers / lockfiles), sorted by total reclaimable size.
- **Safe**, **review**, and **blocked** counts and bytes are shown per workspace; totals count each artifact once (no parent/child double-count).
- Use the row checkbox to **select all safe-tier items** for that workspace only; combine with the global **Select only safe** or manual tweaks as needed.
- **Show all** expands past the top 12 workspaces. For row-by-row browsing, enable **Group by project** on the results table.

## Free-space planner

1. Run a scan first.
2. Set **Target to free (GB)** in the sidebar card.
3. **Plan safe** — fills selection from largest safe candidates until target.
4. **Incl. review** — may add review-tier rows if needed to reach the goal.
5. **Preview cleanup** — same gate as manual cleanup.

## Quarantine center

- **Search** — filter by path or id.
- **Purge-eligible only** — items past retention (see Settings).
- **Restore selected** — bulk restore via native API.
- **Export log** — JSON audit of visible entries.
- **Purge eligible** — permanently remove old quarantine payloads.

## Settings worth knowing

| Setting | Effect |
|---------|--------|
| Calculate sizes | Off = faster scan (list only) |
| Check global Go / JVM / IDE caches | Adds review-tier global targets |
| Include Python venv | High-risk; review tier |
| Advanced Mode | Required for hard-delete (if exposed in your build) |
| NTFS USN journal probe (Experimental, Windows) | Off by default. When on, scans prepend warnings about USN journal visibility on drive-letter volumes; discovery is still a full walk |
| IDE data on the OS drive | **Tool storage migration** (Windows): Plan + Run with confirm modal; manual guide below as fallback |

### Custom scan folders

When **Custom folders** mode is on, adding paths like `%USERPROFILE%\.cargo` or global npm/pnpm caches triggers a **toolchain cache warning** on the Dashboard before you can start a scan. Remove the path or choose **Scan anyway** after reading the warning — Deco is meant for project artifacts, not global stores. See [safety.md](../product/safety.md).

### Policy pack gallery (Settings)

1. Open **Settings** → **Policy pack**.
2. Pick a card from the **gallery** (five shipped examples) or **Browse custom pack…**.
3. Read the **Preview** JSON (read-only).
4. **Choose project folder…** — where `.deco/disk-cleanup.json` should be written.
5. Review validation and **replace preview** (top-level diff when a file already exists).
6. **Apply policy pack**, then **Reveal in Explorer** if you want to open the `.deco` folder.

Validate from CLI: `deco validate-policy examples/deco-policies/python-data-science`.

### Tool storage migration (Windows)

When `%APPDATA%` / `%LOCALAPPDATA%` folders (Cursor, VS Code, etc.) fill a small **C:** volume:

1. On the **Dashboard**, if the OS drive is low on space, a **migration handoff** banner may suggest tools with data on that drive — click **Open Tool storage migration**.
2. Open **Settings → Tool storage migration (Windows)** (or use the banner link).
3. Pick a **tool** profile (e.g. Cursor Roaming + Local) and a **destination root** on NTFS (e.g. `D:\DevToolData`).
4. Click **Plan** — review source/dest paths, estimated size, and warnings. Close the tool if running processes are reported.
5. Click **Run migration** — read the confirm dialog, then wait for the busy overlay to finish.
6. Restart the tool; confirm settings and history. The audit log path is shown in Settings.

Plan-only profiles (Docker Desktop, npm cache, etc.) show sizing and guidance only — use their settings or the manual guide.

The manual guide remains for rollback steps and tools Deco does not run automatically:

[ide-storage-off-os-drive.md](ide-storage-off-os-drive.md)

CLI `deco migrate-tool-dir` remains for scripting — see [migrate-tool-dir.md](../cli/migrate-tool-dir.md).

### IDE data on the OS drive (manual guide)

When `%APPDATA%` / `%LOCALAPPDATA%` folders (Cursor, VS Code, etc.) fill a small **C:** volume, use **Settings → IDE data on the OS drive** for rollback steps, cache-only cleanup, and tools that need manual or config-based moves:

[ide-storage-off-os-drive.md](ide-storage-off-os-drive.md)

npm, pnpm, and Docker are often easier to move because those tools expose configurable paths.

## Manual QA before a release

Use the checklist in [Milestone 8 — UX](../milestones/milestone-8.md#manual-qa-checklist-windows-installer).
