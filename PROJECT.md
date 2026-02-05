# Deco (Developer Compact)

A safe, cross-ecosystem disk cleanup CLI designed for developer machines with many local repositories.

## Goals

- **Safety-first**
  - Dry-run by default.
  - Deletion requires explicit intent (e.g. `--delete --yes`).
  - Never delete unknown directories by default.
- **Fast and convenient**
  - Minimal setup.
  - Supports scanning multiple roots (drives / folders).
  - Outputs a clear report of what would be removed and estimated reclaimable space.
- **Cross-ecosystem**
  - JavaScript/TypeScript projects
  - Rust projects
  - Go projects

## Non-goals

- Acting as a general-purpose file deleter.
- Deleting user data directories (e.g. `Documents`, `Desktop`, `Downloads`).
- Automatically modifying system settings.

## Safety model

The tool uses a layered safety model:

1. **Target allowlist**
   - Only directories with known names are targeted.
2. **Dry-run default**
   - The tool never deletes without an explicit delete mode.
3. **Hard confirmation**
   - Deletion requires `--delete --yes`.
4. **Scope control**
   - Requires at least one root; defaults to `cwd`.
   - Supports `--max-depth` to avoid scanning too broadly.

## Target types (planned scope)

### JS/TS

- `node_modules/`
- Build outputs:
  - `dist/`, `build/`, `dist-firefox/`
  - Framework outputs: `.next/`, `.svelte-kit/`, `.astro/`
  - Caches: `.cache/`
- Test artifacts:
  - `test-results/`, `playwright-report/`

### Rust

- `target/`
- `.cargo-target/` (custom build output root used by some setups)
- `pkg/` (common wasm-pack output)

### Go

- Common build outputs:
  - `bin/`, `dist/`, `build/` (project-dependent)
- Tool caches and temp artifacts (optional; behind flags):
  - `go-build/`-style local directories

Note: Go’s main caches are typically in `GOMODCACHE` and `GOCACHE` (global), not per-repo. The tool should treat global cache cleaning as an explicit, separate operation.

### Python (Planned)

- `__pycache__/`
- `.pytest_cache/`
- `.mypy_cache/`
- `venv/`, `.venv/` (optional, might delete environment)
- `build/`, `dist/`, `*.egg-info/`

## Configuration strategy (planned)

Support a repo-local config file, e.g.:

- `.deco/disk-cleanup.json`

Use cases:

- Add custom project-specific output folders.
- Exclude particular folders (e.g., monorepos with nested `dist/` you want to keep).
- Set default roots, max depth, and enabled target kinds.

## Output

The CLI should support:

- Human-readable summary (default)
- JSON report output (optional)


