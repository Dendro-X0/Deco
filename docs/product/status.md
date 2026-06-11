# Project Status (Handoff)

**Last updated:** 2026-06-11 · **Latest shipped:** `v1.0.2` · **In progress:** `v1.1` ([post-v1.0-direction.md](post-v1.0-direction.md))

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
| **In progress** | `v1.1` — [post-v1.0-direction.md](post-v1.0-direction.md) |
| **Shipped** | `v1.0.2` — [manifest](v1.0.2-manifest.md): honesty release + U1 low-yield scan insight |
| **Prior** | `v1.0.1` — custom migration Access denied handling |
| **Prior** | `v1.0.0` — [manifest](v1.0.0-manifest.md): GA developer cleanup |
| **Post-1.0** | [post-v1.0-direction.md](post-v1.0-direction.md) — convenience, security, personas (`v1.0.2` → `v1.1+`) |

### v1.0.0 highlights

- Scan → quarantine → restore GA on Win/macOS/Linux (Windows manually QA'd; other OS via Release CI).
- Stable scan contract `2.8.0`; SECURITY.md; migration handoff + scan-root guardrails from v0.9.10.

### Quick commands

```bash
pnpm install
pnpm check
node scripts/sync-package-manifests.mjs v1.0.0   # after Release assets publish
```

### Shipped recently

| Version | Highlights |
|---------|------------|
| **v1.0.2** | Honesty release; custom copy-assist; U1 scan insight | Shipped |
| **v1.0.1** | Custom migration lock-file fix | Shipped |
| **v1.0.0** | GA cleanup; platform badge; schema audit |
| **v0.9.11** | SECURITY.md; parity fixtures; manual QA script |
| **v0.9.10** | Migration handoff; scan-root guardrails |
