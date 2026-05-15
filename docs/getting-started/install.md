# Install

End users install Deco from **GitHub Releases** only. No npm account or registry token is required.

## Where to download

1. Open the repository **Releases** page on GitHub.
2. Pick the latest tag (`v*`, e.g. `v0.4.0`).
3. Download the artifacts below for your platform.

Full reference: [GitHub Releases](../distribution/github-releases.md).

## Desktop (Windows)

| Artifact | Install |
|----------|---------|
| `.msi` | Double-click installer (recommended for most users) |
| NSIS `.exe` | Alternative installer from the same release |

**Requirements:** Windows 10+, [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (usually already present).

After install, launch **Deco** from the Start menu. Configure scan roots under **Settings** before the first scan.

## CLI (portable)

| Artifact | Contents |
|----------|----------|
| `deco-cli-win-x64.zip` | `deco.cmd`, compiled `dist/`, README |

**Requirements:** [Node.js 20+](https://nodejs.org/) on PATH.

```text
unzip deco-cli-win-x64.zip -d C:\Tools\deco-cli
cd C:\Tools\deco-cli
deco.cmd --help
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
