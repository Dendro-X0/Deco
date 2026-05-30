# Project Status (Handoff)

**Last updated:** 2026-05-29 · **Latest shipped:** `v0.9.8` · Previous: `v0.9.7`

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/typefixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Shipped** | `v0.9.8` — custom folder migration, path blocklist |
| **In dev** | `v0.9.9+` — managed migrations registry (M3) |
| **QA** | Custom toggle + Sims 4 Mods path; block entire Documents |
| **Queue** | M3 managed migrations registry; dest-root validation warning |

### v0.9.5 highlights

- Settings → **Tool storage migration** — Plan + Run, browsers/utilities/games profiles
- **Open source** / **Open destination** on plan paths
- `pnpm build:desktop:msi` for Windows when NSIS times out

## Quick commands

```bash
pnpm install
pnpm check
pnpm build:desktop:msi   # Windows MSI only
```
