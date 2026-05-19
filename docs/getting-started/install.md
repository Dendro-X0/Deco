# Install

End users install Deco from **GitHub Releases** only. No npm account or registry token is required.

## Where to download

1. Open the repository **Releases** page on GitHub.
2. Pick the latest tag (`v*`, e.g. `v0.4.0`).
3. Download the artifacts below for your platform.

Full reference: [GitHub Releases](../distribution/github-releases.md).

## Desktop

| OS | Artifact | Install |
|----|----------|---------|
| Windows | `.msi` | Double-click installer (recommended) |
| Windows | NSIS `.exe` | Alternate installer |
| macOS | `.dmg` | Open disk image, drag Deco to Applications (CI builds Apple Silicon / aarch64) |
| Linux | `.AppImage` | `chmod +x` then run, or use your file manager |
| Linux | `.deb` | `sudo dpkg -i …` or open with software installer |

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
