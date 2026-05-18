# Smart scan strategy (pattern registry)

**Status:** Shipped in `v0.6.5` (ongoing pattern additions in `v0.6.6+`)  
**Related:** [PROJECT.md](../../PROJECT.md#scanning-philosophy-whitelist--layered-rules) · [v0.6.5 manifest](../product/v0.6.5-manifest.md)

---

## Problem

**Whitelist discovery** (explicit `Kind` + `discover_*` functions) is the safest and most explainable approach, but every new tool (Android Studio, JetBrains, mobile SDKs) requires a code change and release.

We want a **second layer** that can recognize *families* of paths from a **declarative pattern table** — without ML and without inventing new delete targets outside registered kinds.

## Design principles

1. **Still whitelist-only** — patterns map to existing `Kind` values (`ide_global_cache`, `unknown_artifact`, …). No new risk tier without schema + tests.
2. **Opt-in** — `smart_discovery_enabled` (default off). Global-cache patterns require the matching `check_*` flag (e.g. IDE cache + `check_ide_global_cache`).
3. **Deterministic** — same paths + settings → same candidates; every match logs a pattern id in reason codes (future).
4. **Incremental expansion** — add rows to `discovery_patterns.rs` (or JSON later), not open-ended “large folder” heuristics.
5. **Complementary, not replacement** — explicit `discover_*` and walk-time name rules run first; patterns fill gaps (IDE install trees, nested `caches` folders).

## Two discovery layers

| Layer | Where | Examples |
|-------|--------|----------|
| **L1 — Explicit** | `detect_kind` names, `discover_*_global_caches` | `node_modules`, `~/.gradle/caches`, npm store |
| **L2 — Smart patterns** | `discovery_patterns::match_walk_pattern` | `…/Google/AndroidStudio*/caches`, `…/JetBrains/*/caches` |

L2 runs only when `smart_discovery_enabled` is true.

## Pattern row shape (v0.6.5)

```text
pattern_id          — stable id for tests and diagnostics
dir_name            — directory base name to match (e.g. "caches")
path_contains       — case-insensitive substring on full path
requires_kind_flag  — which opt-in setting must be on (e.g. check_ide_global_cache)
maps_to             — Kind enum value
```

Future: optional `child_marker` (must contain file X), `profile_min` (balanced+), `max_depth`.

## What smart scan is NOT

- LLM / “this looks deletable” scoring  
- Scanning all of `%AppData%` or `C:\` without kind rules  
- Auto-delete or bypassing review for global caches  
- Replacing per-tool `discover_android_sdk` — those remain explicit when we add them

## Android Studio & JetBrains (first patterns)

| Pattern | Path signal | Kind | Opt-in |
|---------|-------------|------|--------|
| `android_studio_caches` | `Google/AndroidStudio` + dir `caches` | `ide_global_cache` | `check_ide_global_cache` |
| `jetbrains_ide_caches` | `JetBrains` + dir `caches` | `ide_global_cache` | `check_ide_global_cache` |
| `pnpm_store_walk` / L1 name | dir `.pnpm-store` (or `pnpm-store`) with `v3/` marker | `pnpm_global_store` | `check_pnpm_store` |

**L1 (explicit):** `.pnpm-store` is matched during directory walk without smart discovery — same `v3` marker as global store discovery.

Next candidates (document before implement): `.android/build-cache`, Gradle `daemon` logs, SDK `temp` under `Android/Sdk` with markers.

## Safety checklist (each new pattern)

1. False-positive test on `Program Files`, VS toolchain, active project `build/` without markers  
2. Path policy still applies after classify  
3. Default risk tier unchanged for that kind  
4. Regeneration hint in UI  
5. Entry in this doc + manifest acceptance row

## Success metrics

- Android Studio users see IDE caches when **IDE global cache** + **Smart discovery** are on  
- No increase in blocked-path incidents in CI  
- Pattern table stays &lt; 50 rows for 0.6.x (avoid second codebase)

## v0.6.5 implementation scope

- Setting `smart_discovery_enabled`  
- `discovery_patterns` module + first two IDE patterns  
- Setting `classify_parallel_threshold` (advanced) for classify rayon gate  
- Docs + manifest; no CLI flag required in 0.6.5
