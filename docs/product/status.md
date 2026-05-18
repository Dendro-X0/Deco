# Project Status (Handoff)

Last updated: 2026-05-18 · **Latest shipped:** `v0.7.5` · **Development:** `v0.7.6` → `v0.7.7` → [v0.8.x-roadmap](v0.8.x-roadmap.md)

---

## How we ship

1. **Roadmap order** — one feature set per version; complete the manifest, then tag.  
2. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers (+ per-OS CLI zips). Until then, Windows-only release artifacts are expected.  
3. **Verify** — `pnpm check` + manifest manual QA before each tag.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | [v0.7.6-manifest.md](v0.7.6-manifest.md) — policy gallery + apply polish |
| **Full queue** | [v0.7.x-roadmap.md](v0.7.x-roadmap.md) |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.7.6` | Policy gallery + merge preview / reveal after apply |
| `v0.7.7` | Workspace rollups |
| `v0.8.0` | Multi-platform installers (Win / macOS / Linux) |

---

## v0.7.x shipped (tags)

| Tag | Highlights |
|-----|------------|
| `v0.7.4` | Policy pack Settings UI, parity round 1 |
| `v0.7.5` | Parity round 2, JVM/.NET/Python project detection |
| `v0.7.3` | Shared `cases.json`, CI automation docs |
| `v0.7.2` | `deco validate-policy`, example packs |
| `v0.7.1` | Dormancy panel, git hint, Stale sort |
| `v0.7.0` | Cleanup profiles, regeneration hints |

---

## Key paths

- Classification: `tests/fixtures/classification/cases.json`
- Policy examples: `examples/deco-policies/`
- Release: [release-process.md](../distribution/release-process.md)

---

## Quick commands

```bash
pnpm check
pnpm -F @dendro-x0/deco-cli test classification-parity
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml classification_parity
```
