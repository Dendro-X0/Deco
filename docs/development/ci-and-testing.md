# CI and testing

## Pull requests and main

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

- `pnpm test:cli` (Vitest in `apps/cli`)
- `pnpm test:rust` (`cargo test` in `apps/desktop/src-tauri`)

Triggered on PRs and pushes to `main` / `master`.

## Tagged releases

[`.github/workflows/release.yml`](../../.github/workflows/release.yml):

- Same tests on Ubuntu
- Windows job: MSI/NSIS + `deco-cli-win-x64.zip` → GitHub Release assets

Details: [Distribution — GitHub Releases](../distribution/github-releases.md), [Milestone 6](../milestones/milestone-6.md).

## Local parity

Always run `pnpm test:all` before opening a PR. Desktop UI changes: also run `pnpm exec tsc --noEmit` in `apps/frontend`.
