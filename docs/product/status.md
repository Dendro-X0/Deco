# Project Status (Handoff)

Last updated: 2026-05-19 · **Latest GitHub Release:** `v0.8.1` · **Development:** `v0.8.2` → [v0.8.x-roadmap](v0.8.x-roadmap.md)

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/typefixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | [v0.8.2-manifest.md](v0.8.2-manifest.md) — localization |
| **Queue** | [v0.8.3-manifest.md](v0.8.3-manifest.md) — README demos |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.8.2` | Localization (i18n catalog + language selector) |
| `v0.8.3` | README product demos |

## Quick commands

```bash
pnpm install     # required after clone or `pnpm clean`
pnpm check
pnpm dev:desktop
```
