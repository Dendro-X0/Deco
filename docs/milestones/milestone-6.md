# Milestone 6 — Distribution + CI

## Goal

One-command local verification for contributors, automated tests on pull requests, and **GitHub Releases** for desktop installers plus an optional CLI zip—no npm token required for end users.

## What shipped

### Monorepo scripts (repo root)

| Script | Purpose |
|--------|---------|
| `pnpm test` / `pnpm test:cli` | Vitest in `apps/cli` |
| `pnpm test:rust` | `cargo test` in `apps/desktop/src-tauri` |
| `pnpm test:all` | CLI + Rust |
| `pnpm build:frontend` | Vite production build |
| `pnpm build:cli` | TypeScript CLI compile |
| `pnpm build:desktop` | Frontend build + `tauri build` |
| `pnpm package:cli` | Stage `.artifacts/deco-cli` (+ `deco.cmd`, README) |

### GitHub Actions

- **[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)** — on `push` to `main`/`master` and on all PRs: `pnpm test:cli` + `pnpm test:rust`.
- **[`.github/workflows/release.yml`](../.github/workflows/release.yml)** — on tag `v*`: same tests, then Windows job builds MSI/NSIS + `deco-cli-win-x64.zip` and attaches to the GitHub Release.

Removed legacy workflows that pointed at a non-existent root `src-tauri` or published to npm.

### End-user install path

- **Desktop**: download `.msi` / NSIS `.exe` from GitHub Releases (tag `v*`).
- **CLI**: download `deco-cli-win-x64.zip`, unpack, run `deco.cmd` or `node dist/cli.js` (Node 20+).

See [distribution/github-releases.md](../distribution/github-releases.md) and [getting-started/install.md](../getting-started/install.md).

## Contributor quick start

```bash
pnpm install
pnpm test:all
pnpm build:desktop    # Windows + WebView2 + Rust toolchain
pnpm package:cli      # optional portable CLI folder
```

## Cutting a release

1. Bump versions if needed (`apps/desktop/src-tauri/tauri.conf.json`, `package.json` / CLI as you prefer).
2. Commit and tag: `git tag v0.4.0 && git push origin v0.4.0`
3. The **Release** workflow uploads installers + CLI zip to the GitHub Release page.

## Acceptance checklist

- [x] pnpm workspace: documented one-command test/build
- [x] CI on pull requests (CLI + Rust)
- [x] Release workflow for desktop MSI/NSIS
- [x] Optional CLI zip on release (no npm registry for end users)
