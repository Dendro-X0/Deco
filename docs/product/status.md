# Project Status (Handoff)

Last updated: 2026-05-18 · **Latest shipped:** `v0.7.6` · **Development:** `v0.7.7` → [v0.8.x-roadmap](v0.8.x-roadmap.md)

---

## How we ship

1. **Roadmap order** — one feature set per version; complete the manifest, then tag.  
2. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers (+ per-OS CLI zips). Until then, Windows-only release artifacts are expected.  
3. **Verify** — `pnpm check` + manifest manual QA before each tag.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | [v0.7.7-manifest.md](v0.7.7-manifest.md) — workspace rollups |
| **Queue** | [v0.7.x-roadmap.md](v0.7.x-roadmap.md) |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.7.7` | Workspace rollups (monorepo summary) |
| `v0.8.0` | Multi-platform installers (Win / macOS / Linux) |

---

## v0.7.x shipped (tags)

| Tag | Highlights |
|-----|------------|
| `v0.7.6` | Policy pack gallery, replace diff, Reveal in Explorer |
| `v0.7.5` | Parity round 2, JVM/.NET/Python project detection |
| `v0.7.4` | Policy pack Settings UI, parity round 1 |

---

## Quick commands

```bash
pnpm check
deco validate-policy examples/deco-policies/python-data-science
```
