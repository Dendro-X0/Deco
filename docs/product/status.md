# Project Status (Handoff)

Last updated: 2026-05-16 · Release **v0.5.1** shipped

## Current Direction

- Primary product track is **Deco Desktop (Tauri + Rust backend + Vite/React UI under `apps/frontend`)**.
- Distribution target is **desktop installers / GitHub Releases**, not npm.
- Safety model remains default-first:
  - quarantine default
  - blocked targets never deleted
  - review targets require explicit two-step confirmation + typed phrase

## Completed in Current Cycle

- **Milestone 8** (desktop UX): guided cleanup wizard, preview modal, review phrase, planner + quarantine polish — [milestone-8](../milestones/milestone-8.md).
- **Milestone 7** (ecosystem expansion): Python / JVM / .NET markers, global JVM + IDE caches, Python venv opt-in, contract 2.1.0 — [milestone-7](../milestones/milestone-7.md).
- **Milestone 6** (distribution + CI): `ci.yml`, `release.yml`, root scripts, CLI zip packaging — [milestone-6](../milestones/milestone-6.md).
- **Milestone 5** (performance): cancellable scans + partial results, parallel sizing, walk pruning, fast path — [milestone-5](../milestones/milestone-5.md).
- **Milestone 4** (Go + global cache): `go.mod`-gated project dirs; `--check-go-cache` / `check_go_cache`; review-tier global caches + execute guard — [milestone-4](../milestones/milestone-4.md).
- **Milestone 3** (config + ignore rules): optional `.deco/disk-cleanup.json` merged per scan root + cwd on desktop; CLI `--config` with overlay-friendly schema (`apps/cli/config.schema.json`); deterministic sorted union for excludes and safety lists; see [milestone-3](../milestones/milestone-3.md).
- Backend commands added and wired:
  - `preview_execute`
  - `cancel_scan`
  - `scan_history`
  - `restore_quarantine_bulk`
  - `list_quarantine_filtered`
  - `plan_free_space`
- Scan event model expanded:
  - progress phases (`discover`, `classify`, `size`, `done`)
  - incremental candidate streaming (`scan-candidate-batch`)
- Advanced-mode hard-delete guard implemented end-to-end:
  - backend enforcement
  - UI disable/hide behavior unless `advanced_mode=true`
- UI enhancements implemented:
  - candidate detail panel (reason/path/project root/stale-days)
  - cleanup preview modal before execute
  - quarantine filtering + bulk restore
  - scan history panel + rerun flow
  - free-space planner panel/actions
  - progress bar + phase text + error drawer
- Persistence/schema updates:
  - additive schema updates for events/indexes
- Tests:
  - Rust unit/integration suite (`apps/desktop/src-tauri`): `cargo test`
  - CLI (`apps/cli`): `pnpm -F @dendro-x0/deco-cli test`

## Forward priorities

See **[version-roadmap.md](version-roadmap.md)** for the phased plan (HDD/SSD-agnostic):

| Phase | Versions | Theme |
|-------|----------|--------|
| A | `v0.4.11` ✓ | Dashboard/Settings UX polish (filters, progress, shortcuts, onboarding, planner) |
| B | `v0.5.2` (WIP) | Conda pkgs cache + regeneration hints; conda envs deferred |
| C | `v0.6.x` | Scan engine: phased sizing, adaptive concurrency, incremental inventory |
| D | `v0.7.x` | Profiles, dormancy hints, policy packs, classification parity |
| E | `v0.8+` | macOS/Linux GA, distribution expansion |

## Known gaps / maintenance

- Optional distribution: winget, macOS/Linux bundles — [github-releases.md](../distribution/github-releases.md#future-distribution-options).
- Validate cancellation UX on very large scans.
- Keep `CHANGELOG.md`, [features.md](features.md), and this file aligned when shipping.

## Quick Resume Commands

```bash
# repo root
pnpm install && pnpm test:all

# desktop dev (from repo root)
pnpm dev:desktop

# Rust engine + commands
cd apps/desktop/src-tauri && cargo test

# CLI only
pnpm -F @dendro-x0/deco-cli test
```

## Key Files for Next Work Session

- Backend commands: `apps/desktop/src-tauri/src/commands/*.rs`
- Engine: `apps/desktop/src-tauri/src/engine/*.rs` (including `disk_cleanup_config.rs`)
- Shared DTOs: `apps/desktop/src-tauri/src/engine/types.rs`
- App state: `apps/desktop/src-tauri/src/state.rs`
- DB schema: `apps/desktop/src-tauri/src/db/schema.sql`
- UI: `apps/frontend/src/**/*`
- CLI config + merge: `apps/cli/src/config.ts`, `apps/cli/src/cli.ts`
- Docs: [docs/README.md](../README.md), [features.md](features.md), [milestones/milestone-3.md](../milestones/milestone-3.md), `CHANGELOG.md`
