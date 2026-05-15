# Release prep — v0.4.0

Checklist before pushing to `origin` and tagging. **Latest tag on remote today: `v0.3.0`** — this release should use **`v0.4.0`** (monorepo + desktop milestones M4–M8).

## Pre-flight

- [x] `pnpm test:all` green locally
- [x] Versions aligned to **0.4.0**:
  - `package.json` (monorepo)
  - `apps/cli/package.json`
  - `apps/desktop/package.json`
  - `apps/desktop/src-tauri/tauri.conf.json`
  - `apps/desktop/src-tauri/Cargo.toml`
- [ ] Review `git status` — large monorepo migration; ensure no secrets in diff
- [ ] Optional: `pnpm build:desktop` on Windows before tag (catches Tauri issues early)
- [ ] Optional: [M8 manual QA](../milestones/milestone-8.md#manual-qa-checklist-windows-installer) on installer

## What the Release workflow will upload

Only **Windows** artifacts (see [ci-and-release-platforms.md](ci-and-release-platforms.md)):

- MSI + NSIS from `apps/desktop/src-tauri/target/release/bundle/`
- `deco-cli-win-x64.zip`

## Git commands (after you review the diff)

```bash
# Stage everything intended for this release (adjust if you want smaller commits)
git add -A
git status

git commit -m "$(cat <<'EOF'
Release v0.4.0: monorepo desktop app, CLI, CI, and docs encyclopedia.

Ships Windows installers via GitHub Releases, milestones M4–M8, scan contract 2.1.0.
EOF
)"

git push origin main

git tag -a v0.4.0 -m "v0.4.0 — Deco desktop + CLI (Windows release artifacts)"
git push origin v0.4.0
```

The **Release** workflow runs on `v0.4.0` push: tests on Ubuntu, then Windows build + GitHub Release upload.

## After the workflow finishes

1. Open https://github.com/Dendro-X0/Deco/releases/tag/v0.4.0
2. Confirm assets: `.msi`, NSIS `.exe`, `deco-cli-win-x64.zip`
3. Smoke-test install + guided cleanup
4. Edit release notes if auto-generated text needs a summary bullet list

## Version note

Desktop `tauri.conf.json` was **0.1.0** while CLI was **0.3.0**; **0.4.0** unifies product version across packages for this release.
