# Release process

Maintainers cut releases via **git tags**; CI builds and uploads artifacts.

## Shipping policy

Every **tagged version** must ship a **manifest feature set** (user-visible extension or improvement). Do **not** cut a release tag only to fix CI, typecheck, or docs.

| Situation | What to do |
|-----------|------------|
| CI / typecheck fails on `main` | Fix on `main`, merge, wait for **CI green** — **no new tag** |
| Feature work + CI fix in same period | Land fixes on `main`; **one tag** when the manifest scope is done |
| Tag pushed but Release workflow failed | Fix on `main`, complete the **next feature version** — do not re-tag for CI alone |

**Pre-tag gate:** `pnpm check` (typecheck + lint + `test:all`) locally, and **CI passing on `main`** after the last commit you intend to ship.

## Prerequisites

- Manifest for the version marked complete ([`docs/product/`](../product/))
- `pnpm check` green locally (same as CI: typecheck, lint, CLI + Rust tests)
- Version bumps if needed:
  - `apps/desktop/src-tauri/tauri.conf.json`
  - Root / package versions as you track them
- [CHANGELOG.md](../../CHANGELOG.md) updated — **Added** / **Changed** for user-facing work; CI-only fixes belong in the same version only if shipped with that version’s features (not as a standalone release)

## Cut a release

See also: [release-prep-v0.4.0.md](release-prep-v0.4.0.md) for the current checklist.

```bash
git commit -m "Prepare v0.4.0"
git tag -a v0.4.0 -m "v0.4.0"
git push origin main
git push origin v0.4.0
```

The **Release** workflow (`.github/workflows/release.yml`):

1. Runs CLI + Rust tests on Ubuntu and macOS.
2. Build matrix on **Windows**, **macOS**, and **Linux**: desktop bundles + per-OS CLI zip.
3. Attaches all artifacts to the GitHub Release for that tag.
4. Each matrix upload uses **`fail_on_unmatched_files: true`** — if a platform’s expected globs match nothing (e.g. missing **`.msi`**, **`.exe`**, **`.dmg`**, **`.deb`**, **`.AppImage`**, or CLI zip), that job **fails** so the release does not silently ship without installers.

## Post-release verification

- [ ] Run `node scripts/sync-package-manifests.mjs vX.Y.Z` and open winget-pkgs PR if Windows/macOS assets changed
- [ ] Windows: `.msi` on a clean VM → guided cleanup smoke test
- [ ] macOS: `.dmg` on Apple Silicon (or VM) → drag-to-Applications smoke test
- [ ] Linux: `.AppImage` or `.deb` on Ubuntu → launch smoke test
- [ ] CLI zip per OS → `deco.cmd` / `./deco --help` and dry-run scan
- [ ] Confirm `schema_version` in CLI `--json` matches [contract changelog](../contract/changelog.md)

## Manual QA

Run [Milestone 8 manual QA](../milestones/milestone-8.md#manual-qa-checklist-windows-installer) on the installer build before announcing.

## Legacy npm publish

Root [RELEASE.md](../../RELEASE.md) described npm publish for an older CLI-only distribution. **End-user distribution is GitHub Releases only** — see [github-releases.md](github-releases.md). Do not publish to npm unless you explicitly revive that channel.
