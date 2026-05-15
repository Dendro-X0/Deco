# Release process

Maintainers cut releases via **git tags**; CI builds and uploads artifacts.

## Prerequisites

- `pnpm test:all` green locally
- Version bumps if needed:
  - `apps/desktop/src-tauri/tauri.conf.json`
  - Root / package versions as you track them
- [CHANGELOG.md](../../CHANGELOG.md) updated

## Cut a release

See also: [release-prep-v0.4.0.md](release-prep-v0.4.0.md) for the current checklist.

```bash
git commit -m "Prepare v0.4.0"
git tag -a v0.4.0 -m "v0.4.0"
git push origin main
git push origin v0.4.0
```

The **Release** workflow (`.github/workflows/release.yml`):

1. Runs CLI + Rust tests on Ubuntu.
2. On Windows: builds frontend, Tauri bundles (MSI/NSIS), CLI zip.
3. Attaches artifacts to the GitHub Release for that tag.

## Post-release verification

- [ ] Download `.msi` on a clean VM → install → guided cleanup smoke test
- [ ] Download `deco-cli-win-x64.zip` → `deco.cmd --help` and dry-run scan
- [ ] Confirm `schema_version` in CLI `--json` matches [contract changelog](../contract/changelog.md)

## Manual QA

Run [Milestone 8 manual QA](../milestones/milestone-8.md#manual-qa-checklist-windows-installer) on the installer build before announcing.

## Legacy npm publish

Root [RELEASE.md](../../RELEASE.md) described npm publish for an older CLI-only distribution. **End-user distribution is GitHub Releases only** — see [github-releases.md](github-releases.md). Do not publish to npm unless you explicitly revive that channel.
