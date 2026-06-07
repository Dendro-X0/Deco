# Safety model

Deco is **safety-first**: it prefers under-detection with clear explanations over aggressive deletion.

## Risk tiers

| Tier | Meaning | Default in UI / CLI |
|------|---------|---------------------|
| **safe** | Project-local artifact with strong markers; often stale | Pre-selected after scan |
| **review** | Global caches, venvs, or ambiguous paths | Opt-in + extra confirmation |
| **blocked** | System / runtime / policy-protected | Never deletable |

## Layers of protection

1. **Target allowlist** — only known directory kinds become candidates.
2. **Scope** — scan roots + max depth; optional excludes in config.
3. **Preview** — desktop shows counts and bytes before quarantine (`preview_execute`).
4. **Quarantine-first** — default delete mode moves data aside; restore from Quarantine tab.
5. **Review phrase** — desktop requires typing `DELETE REVIEW` when including review-tier items.
6. **Advanced mode** — hard-delete blocked unless explicitly enabled in settings.

## Global vs project scope

| Class | Examples | Discovery |
|-------|----------|-----------|
| Project | `node_modules`, `target/`, `__pycache__` | Default scan when markers present |
| Global cache | Go `GOCACHE`, JVM `.m2`, Xcode DerivedData | Settings / CLI flags only |
| High-risk | Python `venv/` | `include_python_venv` / `--include-python-venv` |

Execute refuses global/venv targets if the matching setting was off at scan time.

## Scan-root guardrails (v0.9.10)

In **custom scan** mode, Deco warns before scanning paths that look like **global toolchain caches** (e.g. `%USERPROFILE%\.cargo`, `%LOCALAPPDATA%\npm-cache`). Scanning those trees can surface registry or store files as deletable candidates. Remove the path or explicitly choose **Scan anyway** after reading the warning.

## CLI parity

- `--delete` requires `--yes`.
- `--include-review` for review-tier execution.
- Global caches: `--check-go-cache`, `--check-jvm-global-cache`, `--check-ide-global-cache`.

Canonical product definition: [PROJECT.md](../../PROJECT.md).
