# GitHub Releases (primary distribution)

Deco ships to end users through **GitHub Releases** on tag push `v*`. This is the only supported install channel for the desktop app and the packaged CLI.

## Release artifacts

| Artifact | Platform | Audience |
|----------|----------|----------|
| `*.msi` | Windows x64 | Desktop — recommended installer |
| NSIS `*.exe` | Windows x64 | Desktop — alternate installer |
| `deco-cli-win-x64.zip` | Windows | Portable CLI (Node 20+ required) |
| `*.dmg` | macOS (aarch64 from CI) | Desktop — disk image |
| `deco-cli-macos-aarch64.zip` | macOS | Portable CLI (Node 20+ required) |
| `*.deb` | Linux x64 | Desktop — Debian package |
| `*.AppImage` | Linux x64 | Desktop — portable AppImage |
| `deco-cli-linux-x64.zip` | Linux | Portable CLI (Node 20+ required) |

Built by [`.github/workflows/release.yml`](../../.github/workflows/release.yml) after tests pass on Ubuntu and macOS, then a three-OS build matrix.

**Platform coverage:** [CI vs release matrix](ci-and-release-platforms.md).

## GitHub “Deployments” / npm noise

If the repository sidebar shows a failing deployment named **Configure NPM** (or similar), that **does not come from this repo’s CI** (we use **pnpm** only and ship via [**Releases**](https://github.com/Dendro-X0/Deco/releases)). It is usually a **stale GitHub feature** (Packages / suggested npm workflow / an old **Environment** expecting `NODE_AUTH_TOKEN`).

**How to remove the red item (do this in the browser on github.com):**

1. **Actions → (left) “Actions” tab** — open **All workflows**, delete or disable any archived workflow named like *Publish Node.js Package to npm* / *npm-publish* if present.
2. **Settings → Environments** — delete environments named `npm`, `production` (npm), or **Configure NPM** if they only existed for registry publish.
3. **Settings → Secrets and variables → Actions** — remove obsolete `NPM_TOKEN`, `NODE_AUTH_TOKEN`, or npm registry secrets.
4. **Deployments** sidebar may still list old failed runs for a while after cleanup.

Scoped packages here use **`"private": true`** so accidental `npm publish` from a developer machine stays blocked unless explicitly removed.

## End-user install paths

### Desktop

1. Download the installer for your OS from the latest `v*` release — or use **Settings → Updates → Download & install** in the desktop app.
2. Run installer (or mount `.dmg` / run AppImage) → launch Deco.
3. Configure scan roots in Settings.

| OS | Typical file |
|----|----------------|
| Windows | `.msi` or NSIS `.exe` |
| macOS | `.dmg` (Apple Silicon builds from CI) |
| Linux | `.AppImage` or `.deb` |

No Microsoft Store or npm distribution for the desktop app.

### CLI

1. Download the CLI zip for your OS (`deco-cli-win-x64.zip`, `deco-cli-macos-aarch64.zip`, or `deco-cli-linux-x64.zip`).
2. Unzip to a folder on disk.
3. Run `deco.cmd` (Windows), `./deco` (macOS/Linux), or `node dist/cli.js`.

The zip includes a short README; it does **not** bundle Node — users install Node 20+ separately.

## Versioning

- Tag format: `vMAJOR.MINOR.PATCH` (e.g. `v0.8.0`).
- Release notes: auto-generated on the Windows build job; supplement manually for breaking changes.
- Scan contract: check `schema_version` in [contract changelog](../contract/changelog.md) when upgrading automation.

## What we do not ship on Releases (today)

| Channel | Status |
|---------|--------|
| npm registry (`npm publish`) | Not used for end users |
| Intel macOS (`x86_64`) desktop | CI uses Apple Silicon runners (aarch64) |
| Homebrew / winget | Planned `v0.8.1` — [v0.8.x-roadmap](../product/v0.8.x-roadmap.md) |

## Future distribution options

| Option | Notes |
|--------|-------|
| **winget** manifest | Point at GitHub Release `.msi` URL |
| **Homebrew** cask | Point at `.dmg` URL |
| **Intel macOS** | Extra `macos-13` job or cross-compile when needed |
| **CLI without Node** | `pkg` / bundled runtime (larger artifact) |

## Related

- [Install](../getting-started/install.md)
- [Release process](release-process.md) — maintainer checklist
