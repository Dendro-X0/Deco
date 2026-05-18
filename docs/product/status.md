# Project Status (Handoff)

Last updated: 2026-05-18 · Release **v0.7.3** shipped (tag `v0.7.3`); **v0.7.4** in development on `main`

---

## Next session — start here

| Item | Location |
|------|----------|
| **Version target** | `v0.7.4` (workspace already bumped after release commit) |
| **Scope** | [v0.7.4-manifest.md](v0.7.4-manifest.md) — desktop policy-pack apply + expand `tests/fixtures/classification/cases.json` |
| **Do not start** | README GIF demos (deferred to `v0.8.x` / `v1.x`) |
| **Verify** | `pnpm check` from repo root |
| **Recent ship** | `v0.7.3` — classification parity fixtures, [ci-automation.md](../cli/ci-automation.md), `scripts/ci-scan-gate.mjs` |

### v0.7.x shipped on main (tags)

| Tag | Highlights |
|-----|------------|
| `v0.7.0` | Cleanup profiles, regeneration hints UI |
| `v0.7.1` | Dormancy panel, git hint, Stale sort |
| `v0.7.2` | `deco validate-policy`, example packs in git |
| `v0.7.3` | Shared `cases.json` parity tests, CI automation docs |

### Key paths (v0.7.3 / v0.7.4)

- Classification fixtures: `tests/fixtures/classification/cases.json`
- CLI parity test: `apps/cli/tests/classification-parity.test.ts`
- Rust parity test: `apps/desktop/src-tauri/src/engine/classification_parity.rs`
- Policy examples: `examples/deco-policies/` (`.deco` un-ignored under `examples/` only)
- CI gate script: `scripts/ci-scan-gate.mjs`

### Local workspace notes

- **Uncommitted:** `apps/frontend/src/App.tsx` may have whitespace-only diffs — safe to revert before feature work.
- **CI lesson:** Example policy packs must be **tracked in git** (`.gitignore` has `!examples/deco-policies/**/.deco/**`).

---

## Current Direction

- Primary product track is **Deco Desktop (Tauri + Rust backend + Vite/React UI under `apps/frontend`)**.
- Distribution target is **desktop installers / GitHub Releases**, not npm.
- Safety model remains default-first:
  - quarantine default
  - blocked targets never deleted
  - review targets require explicit two-step confirmation + typed phrase

## Completed in Current Cycle

- **v0.7.3** — classification parity + CI automation (see [v0.7.3-manifest.md](v0.7.3-manifest.md)).
- **v0.7.2** — `deco validate-policy`, committed example policy packs.
- **v0.7.1** — dormancy signals, optional git hint.
- **v0.7.0** — cleanup profiles, regeneration hints panel.
- **Milestone 8** (desktop UX): guided cleanup wizard, preview modal, review phrase, planner + quarantine polish — [milestone-8](../milestones/milestone-8.md).
- **Milestone 7** (ecosystem expansion): Python / JVM / .NET markers, global JVM + IDE caches, Python venv opt-in, contract 2.1.0 — [milestone-7](../milestones/milestone-7.md).
- **Milestone 6** (distribution + CI): `ci.yml`, `release.yml`, root scripts, CLI zip packaging — [milestone-6](../milestones/milestone-6.md).
- **Milestone 5** (performance): cancellable scans + partial results, parallel sizing, walk pruning, fast path — [milestone-5](../milestones/milestone-5.md).
- **Milestone 4** (Go + global cache): `go.mod`-gated project dirs; `--check-go-cache` / `check_go_cache`; review-tier global caches + execute guard — [milestone-4](../milestones/milestone-4.md).
- **Milestone 3** (config + ignore rules): optional `.deco/disk-cleanup.json` merged per scan root + cwd on desktop; CLI `--config` with overlay-friendly schema (`apps/cli/config.schema.json`); deterministic sorted union for excludes and safety lists; see [milestone-3](../milestones/milestone-3.md).

## Forward priorities

See **[version-roadmap.md](version-roadmap.md)**:

| Phase | Versions | Theme |
|-------|----------|--------|
| D | `v0.7.4` (active) | Policy pack desktop UX, expanded parity fixtures |
| E | `v0.8+` | macOS/Linux GA, winget/Homebrew, localization |
| — | `v0.8.x` / `v1.x` | README product demo GIFs (backlog) |

## Known gaps / maintenance

- Optional distribution: winget, macOS/Linux bundles — [github-releases.md](../distribution/github-releases.md#future-distribution-options).
- GitHub **Latest** release label may lag until Release workflow finishes; tags are source of truth.
- Keep `CHANGELOG.md`, [features.md](features.md), and this file aligned when shipping.

## Quick Resume Commands

```bash
# repo root
pnpm install && pnpm check

# desktop dev
pnpm dev:desktop

# parity tests only
pnpm -F @dendro-x0/deco-cli test classification-parity
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml classification_parity

# policy validate
pnpm build:cli && node apps/cli/dist/cli.js validate-policy examples/deco-policies/monorepo-maintainer
```

## Key Files for Next Work Session

- Backend commands: `apps/desktop/src-tauri/src/commands/*.rs`
- Engine: `apps/desktop/src-tauri/src/engine/*.rs` (`classifier.rs`, `classification_parity.rs`, `disk_cleanup_config.rs`)
- UI: `apps/frontend/src/**/*` (Settings for policy pack UX)
- CLI: `apps/cli/src/policy-validate.ts`, `apps/cli/src/config.ts`
- Docs: [v0.7.4-manifest.md](v0.7.4-manifest.md), `CHANGELOG.md` [Unreleased]
