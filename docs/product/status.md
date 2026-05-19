# Project Status (Handoff)

Last updated: 2026-05-19 · **Latest GitHub Release:** `v0.7.8` · **Development:** `v0.8.0` → [v0.8.x-roadmap](v0.8.x-roadmap.md)

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/type fixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## `v0.8.0` on `main` (ready to tag)

| Item | Status |
|------|--------|
| `release.yml` build matrix (Windows / macOS / Linux) | On `main` (`a3bccca`) |
| Tauri bundles `dmg`, `deb`, `appimage` | On `main` |
| Per-OS CLI zips + `deco` launcher | On `main` |
| `pnpm check` + CI on `main` | Green |
| First **Release** run with 3 OS jobs | **Pending** — happens on tag `v0.8.0` |

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | [v0.8.0-manifest.md](v0.8.0-manifest.md) — tag when Release workflow passes |
| **Queue** | [v0.8.1-manifest.md](v0.8.1-manifest.md) — winget + Homebrew |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.8.0` | Multi-platform installers (Win / macOS / Linux) — **implement on `main`; tag to publish** |
| `v0.8.1` | winget + Homebrew |

## Pre-release gate (before tagging `v0.8.0`)

```bash
pnpm install
pnpm check
```

Tag `v0.8.0` only after the **Release** workflow succeeds on the tag (Windows + macOS + Linux build matrix). Smoke-test at least one installer per OS when possible.

## Quick commands

```bash
pnpm install     # required after clone or `pnpm clean`
pnpm check
pnpm dev:desktop
```
