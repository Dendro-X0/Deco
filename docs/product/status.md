# Project Status (Handoff)

Last updated: 2026-05-18 · **Latest shipped:** `v0.7.4` · **Development:** `v0.7.5` → `v0.7.7` → [v0.8.x-roadmap](v0.8.x-roadmap.md)

---

## How we ship

1. **Roadmap order** — one feature set per version; complete the manifest, then tag.  
2. **Three platforms** — from **`v0.8.0`**, every release ships Windows, macOS, and Linux installers (+ per-OS CLI zips). Until then, Windows-only artifacts are expected.  
3. **Verify** — `pnpm check` + manifest manual QA before each tag.

---

## Next session — start here

| Item | Location |
|------|----------|
| **Active** | [v0.7.5-manifest.md](v0.7.5-manifest.md) — parity round 2 (implementing on `main`) |
| **Full 0.7.x queue** | [v0.7.x-roadmap.md](v0.7.x-roadmap.md) |
| **After 0.7.7** | [v0.8.x-roadmap.md](v0.8.x-roadmap.md) starting with [v0.8.0-manifest.md](v0.8.0-manifest.md) |
| **Do not skip** | Versions are ordered; finish Phase D (`0.7.5`–`0.7.7`) before Phase E (`0.8.0+`) |

### Version queue (summary)

| Version | Feature set |
|---------|-------------|
| `v0.7.4` | Policy pack desktop + parity round 1 — shipped |
| `v0.7.5` | Classification parity round 2 — in progress |
| `v0.7.6` | Policy gallery + apply polish |
| `v0.7.7` | Workspace rollups |
| `v0.8.0` | Multi-platform installers (Win / macOS / Linux) |
| `v0.8.1` | winget + Homebrew |
| `v0.8.2` | Localization |
| `v0.8.3` | README GIF demos |
| `v0.8.4` | Windows USN inventory (experimental) |

---

## v0.7.x shipped (tags)

| Tag | Highlights |
|-----|------------|
| `v0.7.0` | Cleanup profiles, regeneration hints UI |
| `v0.7.1` | Dormancy panel, git hint, Stale sort |
| `v0.7.2` | `deco validate-policy`, example packs in git |
| `v0.7.3` | Shared `cases.json` parity tests, CI automation docs |
| `v0.7.4` | Policy pack Settings UI, parity round 1 |

---

## Key paths

- Roadmaps: [version-roadmap.md](version-roadmap.md) · [v0.7.x-roadmap.md](v0.7.x-roadmap.md) · [v0.8.x-roadmap.md](v0.8.x-roadmap.md)
- Classification: `tests/fixtures/classification/cases.json`
- Policy examples: `examples/deco-policies/`
- Release: [release-process.md](../distribution/release-process.md) · [ci-and-release-platforms.md](../distribution/ci-and-release-platforms.md)

---

## Quick commands

```bash
pnpm check

# after v0.7.4 ship, parity only
pnpm -F @dendro-x0/deco-cli test classification-parity
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml classification_parity
```
