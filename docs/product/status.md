# Project Status (Handoff)

Last updated: 2026-05-25 · **Latest GitHub Release:** `v0.8.5` · **Development head:** `v0.9.0` (not tagged) — [v0.9.0-manifest.md](v0.9.0-manifest.md)

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/typefixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | Finish `v0.9.0` — secure directory migration (Windows); **manual QA + tag pending** · [v0.9.0-manifest.md](v0.9.0-manifest.md) |
| **Queue** | USN-assisted discover (narrow walk) — research; no manifest yet |

### v0.9.0 progress (dev only until tagged)

| Gate | State |
|------|--------|
| Rust + CLI + desktop UI | Implemented on `main` / dev build |
| NTFS destination check | Done |
| Docs | [migrate-tool-dir.md](../cli/migrate-tool-dir.md), [user-guide](../desktop/user-guide.md) |
| **Your next step** | Manual Cursor migration test on `G:` (see manifest QA) |
| **Production** | Tag `v0.9.0` only after QA + green CI |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.8.2` | Localization phase 1 (`en`/`cn`/`es`, Dashboard + Settings) |
| `v0.8.3` | Localization phase 2 + UX (History, Quarantine, pickers, modals) |
| `v0.8.4` | README product demos |
| `v0.8.5` | Windows USN / MFT inventory (experimental) |
| `v0.9.0` | Secure tool directory migration (Windows) — **in progress** |

## Quick commands

```bash
pnpm install     # required after clone or `pnpm clean`
pnpm check
pnpm dev:desktop
```
