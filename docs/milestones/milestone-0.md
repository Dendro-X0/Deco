# Milestone 0 — Baseline (shipped)

This milestone defines the **minimum viable Deco** surface: CLI + desktop sharing the same product goals, with safe defaults and the core artifact catalog for JS/TS, Rust, and Playwright-style outputs.

## Deliverables

### CLI (`apps/cli`)

- **Dry-run default** for non-interactive use: `--delete` refuses unless `--yes` is also passed.
- **Interactive default** in a TTY: guided flow without silent deletes.
- **Multi-root scan**: repeat `--root <path>`; if omitted, uses `cwd` (or config roots when config exists).
- **`--max-depth`**: bounds recursion (default merged from config or `6` in code).
- **JSON report**: `--json` after scan.
- **Targets (safe-profile baseline)**:
  - `node_modules/` (with project detection + stale policy for risk)
  - Build / framework outputs: `.next/`, `.svelte-kit/`, `.astro/`, `.cache/`, `dist/`, `build/`, `dist-firefox/`
  - Playwright-style: `test-results/`, `playwright-report/`
  - Rust: `target/`, `.cargo-target/`, `pkg/`

### Desktop (`apps/desktop` + `apps/frontend`)

- Tauri app with SQLite (`deco.db`) under app data.
- Native commands (invoke): scan (+ cancel + history), preview/execute/plan free space, quarantine list/filter/restore/bulk/purge, settings get/save, classify preview.
- Dev: Vite frontend on port **5173** (see `apps/desktop/src-tauri/tauri.conf.json`).

### Repository

- **pnpm workspace** at repo root: `pnpm-workspace.yaml`, packages `@dendro-x0/deco-cli`, `@dendro-x0/deco-desktop`, `@dendro-x0/deco-frontend`.
- **CI**: `.github/workflows/release-desktop.yml` for tagged desktop builds (see workflow file for triggers).

## Verification (local)

From repository root (Windows paths work in Git Bash):

```bash
pnpm install
pnpm test
```

CLI (after `pnpm build:cli` or `pnpm -F @dendro-x0/deco-cli build`):

```bash
pnpm exec --filter @dendro-x0/deco-cli start -- --dry-run --root . --max-depth 4 --no-size
```

Confirm: report prints without deleting; `--delete` without `--yes` exits with an error.

Rust engine tests:

```bash
cd apps/desktop/src-tauri && cargo test
```

Desktop dev (Rust + Node; WebView2 required on Windows):

```bash
pnpm dev:desktop
```

## Out of scope for M0

- Shared versioned JSON schema parity between CLI and desktop (Milestone 2).
- Full ecosystem expansion (Python, JVM, etc.) — see `ROADMAP.md` Milestone 7.
- Go project/global modes as a **required** baseline (optional flags exist; roadmap Milestone 4 expands this).

## References

- Product principles: `PROJECT.md`
- Phased roadmap: `ROADMAP.md`
- Feature list: [product/features.md](../product/features.md)
