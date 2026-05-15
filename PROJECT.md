# Deco (Developer Compact)

A safety-first cleanup tool for **developer machines** with many local repositories. The product spans a **desktop app** (guided workflow, quarantine, restore) and a **CLI** (automation, CI, power users), backed by one **native policy engine** (Rust).

## North star

Deco is **not** a general-purpose disk browser. It competes on **developer-specific waste** (dependencies, build outputs, caches) with **explicit policy**: what we touch, why, and how reversible the action is. Prefer **under-detecting** with clear explanations over aggressive heuristics that erode trust.

## Goals

- **Safety-first**
  - Dry-run / preview by default on destructive paths.
  - Deletion or quarantine requires explicit intent; unknown directories are never targeted by default.
  - Layered model: target allowlist, scope (roots + max depth), risk tiers (`safe` / `review` / `blocked`), optional quarantine with restore.
- **Performance**
  - Fast, cancellable scans; phased work (discover → classify → size) with honest progress.
  - Prune traversal where safe; optional fast modes (e.g. list targets with deferred or capped sizing).
- **Ease of use / low learning curve**
  - Desktop: one primary action per step, plain-language reasons, sensible defaults (e.g. “scan this PC” / picked folders).
  - CLI: a single documented happy path, stable machine-readable output for scripts.
- **Accurate scanning**
  - Reliable project and artifact detection; monorepo- and nested-repo-aware rules where applicable.
  - Clear handling of symlinks, permission errors, and partial failures without corrupting totals.
- **Cross-ecosystem**
  - JavaScript/TypeScript, Rust, Go (baseline); Python and JVM-style stacks as planned expansions.
  - **Project-local** artifacts vs **global** caches (e.g. Go `GOCACHE` / `GOMODCACHE`) as separate, opt-in operations.

## Product surfaces

| Surface | Role |
|--------|------|
| **Desktop** | Trust-building UX: scan, filter, preview, execute with quarantine-first defaults, restore/purge, history, free-space style planning. |
| **CLI** | Automation and integration: same rules, JSON (or equivalent) reports, exit codes, flags for CI and advanced users. |

**Rule:** Scan semantics, risk labels, and reclaimable bytes **must not diverge** between surfaces for the same engine version.

## Cross-surface scan contract (Milestone 2)

- **Versioned JSON**: `schema_version` (e.g. `2.0.0`) on desktop `scan_roots` responses and CLI `--json` output. Machine schema: [`docs/schemas/scan-report.schema.json`](docs/schemas/scan-report.schema.json).
- **Field names**: snake_case envelope aligned with the Rust/Tauri DTOs (`scan_id`, `abs_path`, `reason_codes`, `totals_by_risk`, `totals_by_kind`, `warnings`, …). CLI maps internal hyphen kinds (e.g. `build-artifact`) to wire keys (e.g. `build_artifact`).
- **Semantics & risk rules**: [`docs/contract/scan-contract.md`](docs/contract/scan-contract.md). **Compatibility log**: [`docs/contract/changelog.md`](docs/contract/changelog.md).
- **Classification parity**: TS CLI and Rust desktop engines are still separate implementations; the contract stabilizes **shape and naming** first. Byte-identical classification for the same tree is the convergence target as logic is unified.

## Non-goals

- Acting as a general-purpose file deleter or a full TreeSize-style explorer of every file.
- Deleting arbitrary user data directories (e.g. `Documents`, `Desktop`, `Downloads`).
- Automatically modifying system settings.
- Mixing unrelated domains (e.g. Docker image pruning) into the same mental model as file quarantine—unless explicitly framed as a separate profile or future scope.

## Safety model

1. **Target allowlist** — Only known artifact kinds / directory names are candidates.
2. **Dry-run / preview default** — No destructive execute without explicit confirmation path.
3. **Hard confirmation** — CLI: e.g. `--delete --yes`; desktop: preview + confirmations; review-tier items require stronger acknowledgment (e.g. typed phrase).
4. **Scope control** — At least one root; optional `cwd` default; `--max-depth` (or equivalent) to limit breadth.
5. **Quarantine-first (desktop-aligned)** — Prefer reversible moves where the product supports them; hard-delete only behind explicit advanced policy where applicable.

## Target types (scope)

### JS/TS

- `node_modules/`
- Build outputs: `dist/`, `build/`, `dist-firefox/`, `.next/`, `.svelte-kit/`, `.astro/`, `.cache/`
- Test artifacts: `test-results/`, `playwright-report/`

### Rust

- `target/`, `.cargo-target/`, `pkg/` (wasm-pack)

### Go

- Project-local: `bin/`, `dist/`, `build/` (where applicable)
- Global: `GOCACHE`, `GOMODCACHE` — **opt-in**, separate from per-repo scanning

### Python (planned)

- `__pycache__/`, `.pytest_cache/`, `.mypy_cache/`, `build/`, `dist/`, `*.egg-info/`
- `venv/`, `.venv/` — optional / higher risk; explicit policy only

### JVM / mobile / other (roadmap)

- See `ROADMAP.md` for phased expansion (Gradle, Maven local repo, .NET `bin/`/`obj/`, Xcode-style paths, etc.).

## Configuration strategy (planned)

Repo-local (and optionally user-level) config, e.g. `.deco/disk-cleanup.json`:

- Roots, max depth, enabled target kinds
- Extra disposable directory names
- Excludes (e.g. monorepo `dist/` that must be kept)

## Output

- CLI: human-readable summary (default) + **JSON report** aligned with the shared scan contract.
- Desktop: same underlying data; UI is a view on the contract.

## Experimental directions (optional)

Ideas to validate without committing to all as v1:

- **Dormancy hints** — Rank or explain candidates using signals (e.g. last activity under `src/`, git recency); never auto-delete solely on these signals without user policy.
- **Reclaim context** — Rough “regeneration cost” copy (e.g. “typical `pnpm install` / `cargo build`”) for review-tier anxiety reduction.
- **Workspace grouping** — Roll up monorepo candidates by workspace root in UI and reports.
- **Deep link to external tools** — “Open in Explorer / TreeSize at this path” for ambiguous large folders.

See `ROADMAP.md` for phased delivery and `CHANGELOG.md` for shipped behavior.
