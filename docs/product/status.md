# Project Status (Handoff)

**Last updated:** 2026-05-29 · **Latest shipped:** `v1.1.0` · **In progress:** `v1.2` ([post-v1.0-direction.md](post-v1.0-direction.md))

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
| **In progress** | `v1.2` — U3 regeneration hints in preview; U4 CLI profile flags; M5 expand config wizards |
| **Shipped** | `v1.1.0` — [manifest](v1.1-manifest.md): persona onboarding, rollback helper, npm/pnpm wizard |
| **Prior** | `v1.0.2` — honesty release + U1 low-yield scan insight |
| **Prior** | `v1.0.1` / `v1.0.0` — custom migration fixes; GA cleanup |
| **Post-1.0** | [post-v1.0-direction.md](post-v1.0-direction.md) |

### v1.1 highlights

- Persona onboarding: project drives + cleanup profile on first launch.
- Guided migration rollback steps (listed profiles; manual, not one-click).
- npm/pnpm config-redirect wizard for plan-only profiles.
- Listed IDE migration (VS Code, Cursor, etc.) remains the reliable Windows path.

### Quick commands

```bash
pnpm install
pnpm check
node scripts/sync-package-manifests.mjs v1.1.0   # after Release assets publish
```

### Shipped recently

| Version | Highlights |
|---------|------------|
| **v1.1.0** | U2 persona; M6 rollback; M5 npm/pnpm wizard; parity fixtures | Shipped |
| **v1.0.2** | Honesty release; custom copy-assist; U1 scan insight | Shipped |
| **v1.0.1** | Custom migration lock-file fix | Shipped |
| **v1.0.0** | GA cleanup; platform badge; schema audit |
