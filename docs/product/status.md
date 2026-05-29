# Project Status (Handoff)

**Last updated:** 2026-05-29 · **Latest shipped:** `v0.9.3` · **Ready to tag:** `v0.9.4` — [v0.9.4-manifest.md](v0.9.4-manifest.md)

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/typefixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Tag** | `v0.9.4` after `pnpm check` + CI green — desktop migration wizard (Plan + Run) |
| **QA** | Install `Deco_0.9.4_*` from GitHub Release; quit Cursor; run migration checklist in manifest T1 |
| **Queue** | `v0.9.5` M3 managed migrations registry; Docker run research |

### v0.9.4 progress

| Gate | State |
|------|--------|
| Manifest + phased plan (M1–M2) | Done |
| `ToolMigrationSection` Plan + Run + confirm | Done |
| Version bump → `0.9.4` | Done |
| Docs + CHANGELOG | Done |
| `pnpm check` | Run before tag |
| Manual QA on production installer (T1) | **Deferred** — maintainer tests after install, with Cursor quit |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.9.3` | Manual IDE storage guide; automated Run removed from Settings |
| `v0.9.4` | Desktop migration wizard relaunch — Plan + Run with confirm modal |
| `v0.9.5` | Managed migrations registry (M3) |

## Quick commands

```bash
pnpm install     # required after clone or `pnpm clean`
pnpm check
pnpm build:desktop   # local installer smoke; production QA uses Release artifacts
```

### Tag v0.9.4 (maintainer)

```bash
pnpm check
git commit -m "Prepare v0.9.4"
git tag -a v0.9.4 -m "v0.9.4"
git push origin main
git push origin v0.9.4
```

After CI uploads `Deco_0.9.4_*`, run manifest **Manual QA** on the installed app.
