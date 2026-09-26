# Project Status (Handoff)

**Last updated:** 2026-09-26 · **Latest shipped:** `v1.3.3` · **Queued:** `v1.2` ([post-v1.0-direction.md](post-v1.0-direction.md)) · **Deferred:** v1.3 X2 dest-root hint

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
| **Shipped** | `v1.3.3` — Run closes tool processes (CCleaner-style) before migration |
| **Prior** | `v1.3.2` — resume non-empty dest after partial migration; portable Cursor process detection |
| **Prior** | `v1.3.1` — quiet helpers, migration block reasons, full-disk registry warning |
| **Prior** | `v1.3.0` — [manifest](v1.3-manifest.md): game/Firefox Run, Docker depth, free-space gate, stop-cleanup UX |
| **Queued** | `v1.2` — U3 regeneration hints; U4 CLI profile flags; M5 config wizards |
| **Post-1.0** | [post-v1.0-direction.md](post-v1.0-direction.md) |

### v1.3.2 highlights

- Resume listed-profile Run when destination already has a prior copy (no delete+recopy loop).
- Detect portable Cursor executables in Plan process checks.

### Quick commands

```bash
pnpm install
pnpm check
node scripts/sync-package-manifests.mjs v1.3.2   # after Release assets publish
```

### Shipped recently

| Version | Highlights |
|---------|------------|
| **v1.3.2** | Resume partial migration dest; portable Cursor detection | Shipped |
| **v1.3.1** | Quiet helpers; migration block reasons; full-C: registry warning | Shipped |
| **v1.3.0** | Profile Run graduation; free-space Plan gate; stop-cleanup UX | Shipped |
| **v1.1.0** | U2 persona; M6 rollback; M5 npm/pnpm wizard; parity fixtures | Shipped |
| **v1.0.2** | Honesty release; custom copy-assist; U1 scan insight | Shipped |
| **v1.0.1** | Custom migration lock-file fix | Shipped |
| **v1.0.0** | GA cleanup; platform badge; schema audit |
