# Milestone 7 — Ecosystem expansion

## Goal

Extend discovery and classification to **Python**, **JVM**, **.NET**, and **IDE global caches**, with the same safety story as Go: project artifacts only when markers exist; global caches and high-risk paths behind explicit opt-in and **review** tier.

## What shipped

### Scan contract (`schema_version` **2.1.0**)

New wire kinds: `python_artifact`, `python_venv`, `jvm_artifact`, `jvm_global_cache`, `dotnet_artifact`, `ide_global_cache`. See [contract changelog](../contract/changelog.md) and [JSON Schema](../schemas/scan-report.schema.json).

### Python

| Target | When discovered | Default tier |
|--------|-----------------|--------------|
| `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`, `.tox`, `.nox`, `dist`, `build` | Ancestor has `pyproject.toml`, `setup.py`, `setup.cfg`, `requirements.txt`, or `Pipfile` | Safe (project artifact) |
| `venv`, `.venv` | Same + **`include_python_venv`** / `--include-python-venv` | Review (`PYTHON_VENV_*` codes) |

CLI: `--no-python-artifacts` disables project Python dirs; `--include-python-venv` opts into venv discovery.

### JVM

| Target | When discovered | Default tier |
|--------|-----------------|--------------|
| Project `build/`, `target/` (non-Rust) | `pom.xml`, `build.gradle`, `build.gradle.kts`, or `settings.gradle` on ancestor | Safe |
| `~/.m2/repository`, `~/.gradle/caches` | **`check_jvm_global_cache`** / `--check-jvm-global-cache` | Review (global cache) |

CLI: `--no-jvm-artifacts` disables project JVM dirs.

### .NET

| Target | When discovered | Default tier |
|--------|-----------------|--------------|
| `bin/`, `obj/` | `.csproj` or `.sln` on ancestor | Safe |

CLI: `--no-dotnet-artifacts` disables .NET dirs.

### IDE global (Xcode DerivedData)

| Path | Platform | Opt-in |
|------|----------|--------|
| `~/Library/Developer/Xcode/DerivedData` | macOS | `check_ide_global_cache` |
| `%LOCALAPPDATA%\Xcode\DerivedData` | Windows | same |

Review tier + execute guard (same pattern as Go/JVM global caches).

### Walk pruning

No descent into `__pycache__`, `.pytest_cache`, `venv`, `.venv`, `obj`, and other ecosystem dirs (documented in scanner `SKIP_DESCENT`).

### Desktop settings (Settings tab)

- **Global JVM caches** → `check_jvm_global_cache`
- **Xcode DerivedData** → `check_ide_global_cache`
- **Include Python venv** → `include_python_venv`

Project Python/JVM/.NET artifact toggles default **on** via `ScanRequest` / settings (`include_python_artifacts`, `include_jvm_artifacts`, `include_dotnet_artifacts`).

### Tests

- Rust: `discovers_python_cache_with_pyproject`, ecosystem gating in `scanner` tests; `cargo test` (28 tests).
- CLI: integration scan for `__pycache__` + `pyproject.toml`; classifier tests for global-cache review tiers; `pnpm -F @dendro-x0/deco-cli test`.

## How to try

**CLI**

```bash
pnpm build:cli
pnpm dev:cli -- --root ./my-python-app --no-size
pnpm dev:cli -- --root ./my-python-app --include-python-venv --include-review --dry-run
pnpm dev:cli -- --check-jvm-global-cache --check-ide-global-cache --include-review --dry-run
```

**Desktop**

1. Settings → enable JVM global / DerivedData / Python venv as needed → Save.
2. Scan; review-tier rows for globals and venv require review inclusion at cleanup time.
3. Execute refuses global caches / venv if the matching setting was off when delete runs.

## Acceptance checklist

- [x] Python project caches with marker gating; venv only with explicit opt-in
- [x] JVM project `build/` with Gradle/Maven signals; `.m2` / Gradle caches opt-in global
- [x] .NET `bin/` / `obj/` with `.csproj` / `.sln` signals
- [x] Xcode DerivedData as opt-in global (macOS + Windows path)
- [x] Classifier tests + clear risk tiers; global vs project scope in CLI flags and desktop settings
- [x] Scan contract 2.1.0 + JSON Schema updated
