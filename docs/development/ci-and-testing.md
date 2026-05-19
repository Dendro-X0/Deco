# CI and testing

## Pull requests and main

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml):

- `pnpm typecheck` (CLI + frontend TypeScript)
- `pnpm lint` (frontend ESLint)
- `pnpm test:cli` (Vitest in `apps/cli`)
- `pnpm test:rust` (`cargo test` in `apps/desktop/src-tauri`, after Linux Tauri apt deps)

Triggered on PRs and pushes to `main` / `master`.

## Tagged releases

[`.github/workflows/release.yml`](../../.github/workflows/release.yml):

- Tests on Ubuntu + macOS
- Build matrix on **Windows**, **macOS**, and **Linux**: desktop bundles + per-OS CLI zip → GitHub Release assets

See [ci-and-release-platforms.md](../distribution/ci-and-release-platforms.md).

Details: [Distribution — GitHub Releases](../distribution/github-releases.md), [Milestone 6](../milestones/milestone-6.md).

## Local parity

Always run `pnpm check` before opening a PR (typecheck + lint + `test:all`).
