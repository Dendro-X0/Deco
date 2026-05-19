# Features

Deco desktop is a native, safety-first cleanup app for developer machines.

Current implementation progress and handoff details: [status.md](status.md).

## Core UX

- Non-terminal UI for scanning and cleanup.
- Risk-first workflow (`safe`, `review`, `blocked`).
- Quarantine-first delete with restore and purge operations.
- Cleanup preview gate before execution with selected count/size, risk breakdown, and mode display.
- Live scan progress updates from native backend events.
  - phases: `discover`, `classify`, `size`, `done`
- Incremental candidate streaming via `scan-candidate-batch` for large scans.
- Scan cancellation via `cancel_scan`.
- Candidate table tools: search, risk filtering, and sorting.
- Persistent selection state across filters/sorting.
- Selection actions: `Select Only Safe` and `Select Visible`.
- Candidate detail panel showing reason, full path, project root, size, reason codes, and a **Regenerate** block for global-cache kinds (CLI/Rust hint parity).
- **Cleanup profiles** in Settings (`first_scan`, `monorepo_maintainer`, `ci_agent`) bundle scan scope, safety profile, discovery flags, and scan strategy; dashboard shows active profile summary.
- **Dormancy context** in candidate detail (stale vs recent vs unknown) and optional git last-commit hint; sort candidates by **Stale** days.
- **Scan strategy** presets (`thorough` / `balanced` / `fast` / `background`) tune depth, concurrency, and Quick update separately from cleanup profiles.
- **Policy pack gallery** in Settings — browse shipped examples with read-only JSON preview, replace diff when a target already has policy, apply to a project folder, and reveal in Explorer after apply.
- Review-risk deletion requires a stronger two-step modal confirmation with explicit target details.
  - final step requires typing `DELETE REVIEW`.
- Scan history panel with quick rerun using prior roots/profile/stale-days.
- Free-space planner (`Free X GB`) with safe-first selection and optional review inclusion.
- **Workspace summary** card on the dashboard (monorepos with 2+ projects) — reclaim totals per detected project root with safe/review/blocked subtotals; checkbox per workspace selects that project’s safe-tier rows only (no double-counting).
- Results table **Group by project** — collapsible project sections (same grouping as workspace rollups).

## Safety

- Protected path policy blocks system and app runtime directories.
- `blocked` targets are never deletable.
- `review` targets require explicit confirmation.
- `hard-delete` is blocked unless `advanced_mode=true` in settings.

## Native Engine

- Rust scanner/classifier/executor under `src-tauri/src/engine`.
- Tauri commands bridge native logic to desktop UI.
- SQLite persistence for scans, candidates, quarantine, and settings.
- Discovery: project markers (Node, Python, JVM, .NET, Go, C++/CMake/Meson/Bazel outputs, Xmake/Premake/Qt, Android **`.cxx`** under Gradle); opt-in **global** caches (npm through **Bazel disk cache** via `BAZEL_DISK_CACHE` + layout); scan contract versioned in `docs/contract/changelog.md`.
- Added command APIs:
  - `preview_execute`
  - `cancel_scan`
  - `scan_history`
  - `restore_quarantine_bulk`
  - `list_quarantine_filtered`
  - `plan_free_space`

## Distribution

- Desktop installer artifacts built via Tauri.
- GitHub Actions workflow builds release artifacts on `v*` tags.
- No npm publication requirement for end users.
