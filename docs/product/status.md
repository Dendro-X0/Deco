# Project Status (Handoff)

Last updated: 2026-05-25 · **Latest GitHub Release:** `v0.9.0` (installers may show `0.8.5` — use **`v0.9.1`** next) · **Development head:** [v0.9.1-manifest.md](v0.9.1-manifest.md)

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/typefixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | `v0.9.1` — migration profile expansion + correct release artifacts · [v0.9.1-manifest.md](v0.9.1-manifest.md) |
| **Queue** | `v0.9.2` Docker run path; USN-assisted discover — research |

### v0.9.1 progress

| Gate | State |
|------|--------|
| Profile catalog (TS + Rust) | Done |
| Claude Code / Codex / cursor-local / npm / pnpm profiles | Done (plan-only where noted) |
| Version bump → `0.9.1` | Done in repo — **tag `v0.9.1` after QA** |
| Installers | Must show `Deco_0.9.1_*` and footer **v0.9.1** |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.8.2` | Localization phase 1 (`en`/`cn`/`es`, Dashboard + Settings) |
| `v0.8.3` | Localization phase 2 + UX (History, Quarantine, pickers, modals) |
| `v0.8.4` | README product demos |
| `v0.8.5` | Windows USN / MFT inventory (experimental) |
| `v0.9.0` | Secure tool directory migration (Windows) — shipped (installer version mismatch; see v0.9.1) |
| `v0.9.1` | More migration profiles + correct `0.9.1` installers — **in progress** |

## Quick commands

```bash
pnpm install     # required after clone or `pnpm clean`
pnpm check
pnpm dev:desktop
```
