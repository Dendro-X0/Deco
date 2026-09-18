# Project Status (Handoff)

**Last updated:** 2026-09-18 · **Latest shipped:** `v1.3.0` · **Queued:** `v1.2` ([post-v1.0-direction.md](post-v1.0-direction.md)) · **Deferred:** v1.3 X2 dest-root hint

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/typefixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Positioning** | Honest OSS commitments — [capabilities-and-limits.md](capabilities-and-limits.md), [positioning.md](positioning.md) |
| **Shipped** | `v1.3.0` — [manifest](v1.3-manifest.md): game/Firefox Run, Docker depth, free-space gate, stop-cleanup UX |
| **Queued** | `v1.2` — U3 regeneration hints; U4 CLI profile flags; M5 config wizards |
| **Prior** | `v1.1.0` — [manifest](v1.1-manifest.md): persona onboarding, rollback helper, npm/pnpm wizard |
| **Prior** | `v1.0.2` — honesty release + U1 low-yield scan insight |
| **Post-1.0** | [post-v1.0-direction.md](post-v1.0-direction.md) |

### v1.3 highlights

- Game launcher Run: Epic / Steam AppData / Battle.net (launcher LocalAppData only).
- Docker Plan depth + config wizard (no VHDX junction Run).
- Firefox Run with `profiles.ini` validation.
- Plan free-space gate (dest × 1.2) + source low-space warning.
- User-stopped cleanup is informational, not a hard failure banner.

### Quick commands

```bash
pnpm install
pnpm check
node scripts/sync-package-manifests.mjs v1.3.0   # after Release assets publish
```

### Shipped recently

| Version | Highlights |
|---------|------------|
| **v1.3.0** | Profile Run graduation; free-space Plan gate; stop-cleanup UX | Shipped |
| **v1.1.0** | U2 persona; M6 rollback; M5 npm/pnpm wizard; parity fixtures | Shipped |
| **v1.0.2** | Honesty release; custom copy-assist; U1 scan insight | Shipped |
| **v1.0.1** | Custom migration lock-file fix | Shipped |
| **v1.0.0** | GA cleanup; platform badge; schema audit |
