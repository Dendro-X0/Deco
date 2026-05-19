# Project Status (Handoff)

Last updated: 2026-05-19 · **Latest GitHub Release:** `v0.8.4` · **Main:** v0.8.5 feature set landed (tag `v0.8.5` when cutting installers) · **Focus:** maintenance hiatus — see [version-roadmap.md](version-roadmap.md)

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/typefixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | Maintenance / hiatus — [v0.8.5-manifest.md](v0.8.5-manifest.md) shipped (USN probe); next work TBD on [version-roadmap.md](version-roadmap.md) |
| **Queue** | USN-assisted discover (narrow walk) — research; no manifest yet |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.8.2` | Localization phase 1 (`en`/`cn`/`es`, Dashboard + Settings) |
| `v0.8.3` | Localization phase 2 + UX (History, Quarantine, pickers, modals) |
| `v0.8.4` | README product demos |
| `v0.8.5` | Windows USN / MFT inventory (experimental) |

## Quick commands

```bash
pnpm install     # required after clone or `pnpm clean`
pnpm check
pnpm dev:desktop
```
