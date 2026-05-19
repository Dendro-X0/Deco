# Project Status (Handoff)

Last updated: 2026-05-18 · **Latest GitHub Release:** `v0.7.6` · **Development:** `v0.7.8` → [v0.8.x-roadmap](v0.8.x-roadmap.md)

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/type fixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers. Until then, Windows-only release artifacts are expected.

---

## Unpublished work on `main` (ships with `v0.7.8`, not as `v0.7.7`)

Git tag `v0.7.7` was pushed before CI passed; **no GitHub Release** was published. That work stays on `main` and will ship as part of **`v0.7.8`** together with workspace rollups — see [v0.7.7-manifest.md](v0.7.7-manifest.md) (changelog reference) and [v0.7.8-manifest.md](v0.7.8-manifest.md) (next tag).

| Already on `main` (ex–0.7.7 scope) | Planned for `v0.7.8` tag |
|-----------------------------------|---------------------------|
| Live cleanup progress + results card | Workspace rollups (monorepo summary) |
| README GIF demos | Rollup dashboard UX + tests |
| Largest-first parallel delete ordering | |

Optional maintainer cleanup: delete remote tag `v0.7.7` after `v0.7.8` ships so Releases stay linear (`v0.7.6` → `v0.7.8`).

---

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | [v0.7.8-manifest.md](v0.7.8-manifest.md) — workspace rollups |
| **Queue** | [v0.7.x-roadmap.md](v0.7.x-roadmap.md) |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.7.8` | Workspace rollups + publish 0.7.7 backlog on GitHub |
| `v0.8.0` | Multi-platform installers (Win / macOS / Linux) |

---

## Pre-release gate (before tagging `v0.7.8`)

```bash
pnpm install
pnpm check    # typecheck → lint → CLI tests → Rust tests
```

Confirm **CI green on `main`** on GitHub, then tag. Last local `pnpm check`: **passed** (134 CLI + 116 Rust tests).

## Quick commands

```bash
pnpm install     # required after clone or `pnpm clean`
pnpm check
pnpm dev:desktop
```
