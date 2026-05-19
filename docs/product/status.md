# Project Status (Handoff)

Last updated: 2026-05-19 · **Latest GitHub Release:** `v0.8.3` · **Development:** `v0.8.4` → [v0.8.x-roadmap](v0.8.x-roadmap.md)

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/typefixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | [v0.8.4-manifest.md](v0.8.4-manifest.md) — README product demos |
| **Queue** | [v0.8.5-manifest.md](v0.8.5-manifest.md) — Windows USN experiment |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.8.2` | Localization phase 1 (`en`/`cn`/`es`, Dashboard + Settings) |
| `v0.8.3` | Localization phase 2 + UX (History, Quarantine, pickers, modals) |
| `v0.8.4` | README product demos |

## Quick commands

```bash
pnpm install     # required after clone or `pnpm clean`
pnpm check
pnpm dev:desktop
```
