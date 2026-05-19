# Install

End users install Deco from **GitHub Releases**, or optionally via **winget** (Windows) / **Homebrew** (macOS). No npm account or registry token is required.

## Quick install

| OS | Command |
|----|---------|
| Windows | `winget install Dendro-X0.Deco` (after [winget-pkgs PR](https://github.com/microsoft/winget-pkgs); see [package managers](../distribution/package-managers.md)) |
| macOS (Apple Silicon) | `brew install --cask https://raw.githubusercontent.com/Dendro-X0/Deco/main/packaging/homebrew/Casks/deco.rb` |
| Any | Download from [GitHub Releases](https://github.com/Dendro-X0/Deco/releases) |

Full reference: [GitHub Releases](../distribution/github-releases.md) · [Package managers](../distribution/package-managers.md).

## Where to download (manual)

## Desktop

| OS | Artifact | Install |
|----|----------|---------|
| Windows | `.msi` | Double-click installer (recommended) |
| Windows | NSIS `.exe` | Alternate installer |
| macOS | `.dmg` | Open disk image, drag Deco to Applications (CI builds Apple Silicon / aarch64) |
| Linux | `.AppImage` | `chmod +x` then run, or use your file manager |
| Linux | `.deb` | `sudo dpkg -i …` or open with software installer |

**Linux note:** There is no single cross-distro package manager like winget. Use `.AppImage` or `.deb` from Releases (see [package managers](../distribution/package-managers.md#linux)).

**Windows requirements:** Windows 10+, [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (usually already present).

After install, launch **Deco**. Configure scan roots under **Settings** before the first scan.

## CLI (portable)

| Artifact | Platform |
|----------|----------|
| `deco-cli-win-x64.zip` | Windows |
| `deco-cli-macos-aarch64.zip` | macOS |
| `deco-cli-linux-x64.zip` | Linux |

**Requirements:** [Node.js 20+](https://nodejs.org/) on PATH.

```text
# Windows
unzip deco-cli-win-x64.zip -d C:\Tools\deco-cli
cd C:\Tools\deco-cli
deco.cmd --help

# macOS / Linux
unzip deco-cli-linux-x64.zip -d ~/tools/deco-cli
cd ~/tools/deco-cli
chmod +x deco
./deco --help
```

Or run directly: `node dist/cli.js --help`

## Verify

**Desktop:** open app → Settings → add at least one scan root → **Scan Now** or **Free up space**.

**CLI:**

```bash
deco.cmd --dry-run --root "C:\path\to\your\repos" --max-depth 4 --no-size
```

## Building from source

Contributors and advanced users: see [Contributing](../development/contributing.md).
