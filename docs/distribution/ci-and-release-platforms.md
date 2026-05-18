# CI vs release — platform matrix

## Summary

| Workflow | Trigger | Runs on | Produces installers? |
|----------|---------|---------|----------------------|
| [**CI**](../../.github/workflows/ci.yml) | PR + push to `main` | **`ubuntu-latest`** + **`macos-latest`** (matrix) | **No** — tests only (`pnpm test:cli`, `pnpm test:rust`) |
| [**Release**](../../.github/workflows/release.yml) | Tag `v*` or manual | Same matrix for tests + **`windows-latest`** (build) | **Windows only** |

**Linux and macOS desktop installers are not produced by release jobs today** — only unit/integration tests run there.

## Release artifacts (current)

| Artifact | OS | Job |
|----------|-----|-----|
| `*.msi` | Windows | `build-windows` |
| NSIS `*.exe` | Windows | `build-windows` |
| `deco-cli-win-x64.zip` | Windows (CLI; needs Node 20+) | `build-windows` |

`tauri.conf.json` sets `"targets": ["msi", "nsis"]` and only `icons/icon.ico` is present — both limit bundling to Windows until `.icns` / PNG icon sets and extra jobs are added.

## Adding macOS / Linux later

1. Add icons: `icon.icns`, `32x32.png`, `128x128.png`, … (or run `pnpm tauri icon` from a master PNG).
2. Extend `bundle.targets` in `tauri.conf.json` (e.g. `dmg`, `deb`, `appimage`).
3. Add matrix jobs in `release.yml`:
   - `macos-latest` → `.dmg` / `.app`
   - `ubuntu-latest` → install `libwebkit2gtk-4.1-dev` etc., then `tauri build`
4. Package CLI zips per OS (or document Node requirement per platform).

See [github-releases.md — Future distribution options](github-releases.md#future-distribution-options).

## Cross-platform update code (Windows-only dev machine)

Maintainers may not have macOS or Linux hardware locally. Validation strategy:

| Layer | What runs where | What it proves |
|-------|-----------------|----------------|
| **Asset matching** | `pickPlatformDownloadAssets` unit tests (Vitest, any OS) | Correct `.dmg` / `.AppImage` / `.deb` choice from GitHub asset names |
| **Installer kind** | `installer_kind_for_target` Rust tests (Windows CI) | Extension → handler mapping for all three OSes |
| **Download + launch** | Manual on Windows; macOS/Linux when hardware or VM available | `open` / `xdg-open` / AppImage chmod behave as expected |
| **Engine regressions** | GitHub Actions `ubuntu-latest` + `macos-latest` test jobs | Rust scanner/classifier compile and pass on non-Windows |

In-app **Download & install** on macOS/Linux follows platform conventions (`open`, `xdg-open`, `chmod +x` AppImage) but is **best-effort until release jobs ship those bundles** and someone verifies on real machines. Until then, users see a clear message and can use **Browser** / GitHub Releases.
