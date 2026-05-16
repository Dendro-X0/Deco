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
