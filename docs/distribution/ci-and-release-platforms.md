# CI vs release — platform matrix

## Summary

| Workflow | Trigger | Runs on | Produces installers? |
|----------|---------|---------|----------------------|
| [**CI**](../../.github/workflows/ci.yml) | PR + push to `main` | **`ubuntu-latest`** + **`macos-latest`** (matrix) | **No** — tests only (`pnpm test:cli`, `pnpm test:rust`) |
| [**Release**](../../.github/workflows/release.yml) | Tag `v*` or manual | **`windows-latest`**, **`macos-latest`**, **`ubuntu-latest`** (build matrix) | **Yes** — per-OS desktop bundles + CLI zips |

From **`v0.8.0`**, every tagged release ships Windows, macOS, and Linux artifacts (see [v0.8.0-manifest.md](../product/v0.8.0-manifest.md)).

## Release artifacts

| Artifact | OS | Build job |
|----------|-----|-----------|
| `*.msi` | Windows x64 | `build` (windows) |
| NSIS `*.exe` | Windows x64 | `build` (windows) |
| `deco-cli-win-x64.zip` | Windows (CLI; Node 20+) | `build` (windows) |
| `*.dmg` | macOS (Apple Silicon / `aarch64` on `macos-latest`) | `build` (macos) |
| `deco-cli-macos-aarch64.zip` | macOS CLI (Node 20+) | `build` (macos) |
| `*.deb` | Linux x64 | `build` (linux) |
| `*.AppImage` | Linux x64 | `build` (linux) |
| `deco-cli-linux-x64.zip` | Linux CLI (Node 20+) | `build` (linux) |

`tauri.conf.json` lists bundle targets `msi`, `nsis`, `dmg`, `deb`, `appimage`. Each release job passes `--bundles` for only the formats built on that runner.

Icons: `icon.ico`, `icon.icns`, and PNG sizes under `apps/desktop/src-tauri/icons/`.

## Cross-platform update code

| Layer | What runs where | What it proves |
|-------|-----------------|----------------|
| **Asset matching** | `pickPlatformDownloadAssets` unit tests (Vitest, any OS) | Correct `.dmg` / `.AppImage` / `.deb` choice from GitHub asset names |
| **Installer kind** | `installer_kind_for_target` Rust tests (Windows CI) | Extension → handler mapping for all three OSes |
| **Download + launch** | Manual on Windows; macOS/Linux when hardware or VM available | `open` / `xdg-open` / AppImage chmod behave as expected |
| **Engine regressions** | GitHub Actions `ubuntu-latest` + `macos-latest` test jobs | Rust scanner/classifier compile and pass on non-Windows |

In-app **Download & install** uses platform conventions (`open`, `xdg-open`, `chmod +x` AppImage). Unsigned macOS/Linux bundles may require Gatekeeper or package-manager approval on first run.

## Related

- [github-releases.md](github-releases.md)
- [release-process.md](release-process.md)
