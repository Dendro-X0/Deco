# Roadmap — Deco

Phased plan for **Deco**: desktop (Tauri + Rust engine) + **CLI**, one policy engine and one scan semantics story. For product principles and safety model, see `PROJECT.md`.

## Guiding principles

- **Trust over breadth**: fewer false positives; explain every candidate class.
- **One engine, two surfaces**: CLI and desktop stay aligned on classification, risk tiers, and reclaim estimates for a given version.
- **Distribution**: standalone binaries and desktop installers (e.g. GitHub Releases)—not dependent on npm/jsr for end users.

---

## Milestone 0 — Baseline (**complete**)

Tracked in [`docs/milestones/milestone-0.md`](docs/milestones/milestone-0.md) (deliverables + local verification commands).

- [x] CLI: dry-run default for scripted use; `--delete` requires `--yes`; multi-root `--root`; `--max-depth`; `--json` report.
- [x] Targets: `node_modules`; JS build outputs including `.next`, `.svelte-kit`, `.astro`, `.cache`, `dist`, `build`, `dist-firefox`; Playwright `test-results` / `playwright-report`; Rust `target`, `.cargo-target`, `pkg`.
- [x] Desktop: Tauri + Rust engine + Vite UI under `apps/desktop`, `apps/frontend`; SQLite persistence; command set for scan/preview/execute/quarantine/history/settings/planner.
- [x] Monorepo: `pnpm` workspace; root `pnpm test` runs CLI tests; `cargo test` in `apps/desktop/src-tauri` for engine.

---

## Milestone 1 — Reliability + scan quality (**complete**)

Details: [`docs/milestones/milestone-1.md`](docs/milestones/milestone-1.md).

- [x] Windows-friendly root handling: duplicate `--root` / equivalent paths deduped (CLI + Rust).
- [x] Walk and size errors surfaced as warnings (no silent `filter_map` drops in Rust; CLI continues with `errors` notes).
- [x] Symlink-safe traversal: `follow_links(false)` in Rust; CLI skips recursing into symlink directories, records symlink-named targets, cycle-safe sizing via visited real paths.
- [x] Canonical dedupe of discovered targets (avoids double-delete / double count when links or duplicate roots point at the same directory).
- [x] CLI phased progress: `discover` → `classify` → `size` in `ProgressUpdate` + interactive spinner.
- [x] Nested monorepo clarity: unique `absPath` per row; use `projectRoot` + path for disambiguation (documented in milestone-1).

---

## Milestone 2 — Shared scan contract + CLI parity (**complete**)

Details: [`docs/contract/scan-contract.md`](docs/contract/scan-contract.md), schema [`docs/schemas/scan-report.schema.json`](docs/schemas/scan-report.schema.json), changelog [`docs/contract/changelog.md`](docs/contract/changelog.md), checklist [`docs/milestones/milestone-2.md`](docs/milestones/milestone-2.md).

- [x] Versioned JSON (`schema_version` `2.0.0`) on desktop `ScanResponse` and CLI `--json`.
- [x] JSON Schema (Draft 2020-12) for the wire envelope + candidates.
- [x] CLI `--json` emits snake_case fields aligned with Rust DTOs; kind keys use underscore wire form (`build_artifact`, …); `warnings` replaces legacy camelCase error array on the wire.
- [x] `totals_by_kind` keys standardized to kind wire strings (Rust `Kind::wire_key()` + CLI parity).
- [x] Risk tier semantics documented in `docs/contract/scan-contract.md` (and `PROJECT.md` cross-link).

**Note:** TS and Rust classifiers remain separate; contract locks **shape and naming** first; byte-identical classification is a convergence goal.

---

## Milestone 3 — Config + ignore rules (**complete**)

Details: [`docs/milestones/milestone-3.md`](docs/milestones/milestone-3.md).

- [x] Optional `.deco/disk-cleanup.json` under each scan root (and cwd) on desktop; CLI `--config <path>` with optional keys / overlay `{}`.
- [x] Schema: roots, `maxDepth`, targets, extra directory names, excludes / safety path contains — `apps/cli/config.schema.json`.
- [x] Deterministic merge: sorted union of layers; desktop unions repo configs with `ScanRequest` / settings; CLI merges `--config` with flags.
- [x] Invalid config fails fast with actionable errors (CLI + Rust parse).
- [x] Excludes honored consistently in CLI and desktop for the same on-disk policy (substring match on absolute paths).

---

## Milestone 4 — Go + global cache story (**complete**)

Details: [`docs/milestones/milestone-4.md`](docs/milestones/milestone-4.md).

- [x] Project-local Go dirs (`bin`, `dist`, `build`, `bin-win`) only when `go.mod` exists on an ancestor path.
- [x] Global Go cache scan via `go env GOCACHE` / `GOMODCACHE` when opted in (`--check-go-cache` / desktop `check_go_cache`).
- [x] Global caches classified as **review** + execute guard; defaults do not scan or delete them.

---

## Milestone 5 — Performance at scale (**complete**)

Details: [`docs/milestones/milestone-5.md`](docs/milestones/milestone-5.md).

- [x] Parallel sizing (desktop rayon batches; CLI `TaskQueue` for FS + sizing).
- [x] Cancellable discovery + sizing; partial results + warnings on cancel.
- [x] Fast path: CLI `--no-size`; desktop `include_size` setting (off = skip sizing).
- [x] Walk pruning: no descent into `node_modules`, `target`, `.git`, common build/vendor dirs (documented).

---

## Milestone 6 — Distribution + CI (**complete**)

Details: [`docs/milestones/milestone-6.md`](docs/milestones/milestone-6.md).

- [x] pnpm workspace scripts: `test:cli`, `test:rust`, `test:all`, `build:desktop`, `package:cli`.
- [x] GitHub Actions **CI** on PRs / main (`ci.yml`).
- [x] GitHub Actions **Release** on `v*` tags: Windows MSI/NSIS + `deco-cli-win-x64.zip` (`release.yml`).
- [x] End users install from GitHub Releases only (no npm token path).

---

## Milestone 7 — Ecosystem expansion (**complete**)

Details: [`docs/milestones/milestone-7.md`](docs/milestones/milestone-7.md).

- [x] **Python**: project caches/build dirs with marker gating; `venv`/`.venv` only with `include_python_venv` / `--include-python-venv` (review tier).
- [x] **JVM**: project `build/` with Gradle/Maven signals; global `~/.m2/repository` and `~/.gradle/caches` via `check_jvm_global_cache` / `--check-jvm-global-cache`.
- [x] **.NET**: `bin/`, `obj/` with `.csproj`/`.sln` signals.
- [x] **IDE**: Xcode `DerivedData` as opt-in global (macOS + Windows `LOCALAPPDATA\Xcode\DerivedData`).
- [x] Scan contract **2.1.0** + schema; classifier tests; CLI flags and desktop settings for global vs project scope.

---

## Milestone 8 — UX depth (desktop-first) + polish (**complete**)

Details: [`docs/milestones/milestone-8.md`](docs/milestones/milestone-8.md).

- [x] Guided **Free up space** wizard (scan → results → preview).
- [x] **Preview cleanup** modal via `preview_execute`; review-tier requires `DELETE REVIEW`.
- [x] **Free Space Planner** wired to `plan_free_space` (safe-first + optional review).
- [x] Quarantine: search filter, bulk restore, purge eligible, JSON audit export.
- [x] Manual QA checklist in milestone doc (run on release candidate).

---

## Forward plan (versions)

Milestones **M0–M8** are complete. Ongoing delivery is tracked by **semver** and product phase:

| Doc | Contents |
|-----|----------|
| [**Version roadmap**](docs/product/version-roadmap.md) | `v0.4.x` UX → `v0.5.x` ecosystems/package managers → `v0.6.x` scan engine → `v0.7.x` trust/community → `v0.8+` platforms |

**Current release:** `v0.7.3` (tagged). **In development:** `v0.7.4` — see [CHANGELOG.md](CHANGELOG.md) and [v0.7.4-manifest.md](docs/product/v0.7.4-manifest.md).

---

## Experimental track (non-blocking)

Pick items as spikes; promote into a version per [version-roadmap.md](docs/product/version-roadmap.md). Spike notes live under [`docs/experiments/`](docs/experiments/README.md).

- **Dormancy ranking** — Explain “likely stale” vs “recent”; no auto-delete on signals alone.
- **Regeneration hints** — Short human text for review-tier rows.
- **Workspace graph / rollups** — Monorepo-first summaries in UI and JSON.
- **External tool links** — Open path in Explorer or optional handoff to TreeSize-style tools.
- **Profiles** — “First-time”, “Monorepo maintainer”, “CI disk” presets (same engine, different defaults).
- **Phased discover → size** — Hardware-agnostic; see `v0.6.x` in version roadmap.
- **Adaptive concurrency** — Bounded parallel sizing; not “max threads everywhere.”
- **Incremental inventory** — SQLite-backed rescan skip for unchanged paths.

---

## Maintenance

- Keep `CHANGELOG.md`, [`docs/product/features.md`](docs/product/features.md), and [`docs/product/status.md`](docs/product/status.md) in sync when behavior or paths change.
- When repo layout differs from older docs (`src-tauri/` vs `apps/desktop`), prefer updating docs in the same PR as moves.
