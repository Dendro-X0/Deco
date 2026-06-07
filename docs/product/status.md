# Project Status (Handoff)

**Last updated:** 2026-05-29 · **Latest shipped:** `v0.9.11` · **Next:** `v1.0.0` ([manifest](v1.0.0-manifest.md))

---

## How we ship

1. **Feature-only tags** — each version delivers a manifest feature set; CI/typefixes land on `main` without a tag ([release process](../distribution/release-process.md)).  
2. **Roadmap order** — complete the manifest, then tag once `pnpm check` and CI are green.  
3. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Roadmap to 1.0** | [v1.0-roadmap.md](v1.0-roadmap.md) |
| **Shipped** | `v0.9.11` — [manifest](v0.9.11-manifest.md): SECURITY.md + parity + 1.0 QA prep |
| **Next** | [v1.0.0-manifest.md](v1.0.0-manifest.md) — GA cleanup tag |

### Shipped recently

| Version | Highlights |
|---------|------------|
| **v0.9.11** | SECURITY.md; parity fixtures; v1.0 manual QA script |
| **v0.9.10** | Migration handoff banner; scan-root guardrails |

### Quick commands

```bash
pnpm install
pnpm check
pnpm dev:desktop
pnpm build:desktop:msi   # Windows MSI only
```
