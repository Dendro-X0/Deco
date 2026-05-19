# Package managers (winget & Homebrew)

Deco’s primary distribution channel is [GitHub Releases](github-releases.md). **`v0.8.1`** adds optional installs via **winget** (Windows) and **Homebrew** (macOS).

## Windows — winget

**Package ID:** `Dendro-X0.Deco`

```powershell
winget install Dendro-X0.Deco
```

Requires the manifest in [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs). Maintainers generate manifests from each release:

```bash
node scripts/sync-package-manifests.mjs v0.8.0
```

See [packaging/winget/README.md](../../packaging/winget/README.md).

Until winget-pkgs merges the PR, download `.msi` from [Releases](https://github.com/Dendro-X0/Deco/releases).

## macOS — Homebrew

Apple Silicon (aarch64) `.dmg` from CI:

```bash
brew install --cask https://raw.githubusercontent.com/Dendro-X0/Deco/main/packaging/homebrew/Casks/deco.rb
```

See [packaging/homebrew/README.md](../../packaging/homebrew/README.md).

Intel Macs: use GitHub Releases if no x64 build is attached.

## Linux

There is no single cross-distro package manager equivalent to winget. Use GitHub Releases:

| Format | Install |
|--------|---------|
| **AppImage** | `chmod +x Deco_*_amd64.AppImage && ./Deco_*_amd64.AppImage` |
| **.deb** | `sudo dpkg -i Deco_*_amd64.deb` (Debian/Ubuntu) |

CLI: `deco-cli-linux-x64.zip` (Node 20+ required).

## Related

- [Install](../getting-started/install.md)
- [Release process](release-process.md) — post-tag manifest sync
