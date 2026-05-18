# Contributing

## Prerequisites

- Node 20+, pnpm
- Rust toolchain (desktop engine)
- WebView2 (Windows desktop dev)

## Setup

```bash
pnpm install
pnpm test:all
```

## Repo layout

| Path | Role |
|------|------|
| `apps/cli` | TypeScript CLI |
| `apps/desktop/src-tauri` | Rust engine + Tauri commands |
| `apps/frontend` | React UI |
| `docs/` | Documentation encyclopedia ([README](../README.md)) |

## Common commands

```bash
pnpm test:cli          # Vitest
pnpm test:rust         # cargo test
pnpm test:all          # both

pnpm build:cli
pnpm build:frontend
pnpm build:desktop     # production installers
pnpm package:cli       # stage .artifacts/deco-cli

pnpm dev:desktop       # Tauri dev (needs `pnpm install` first)
pnpm dev:cli -- --dry-run --root . --no-size
pnpm icons:generate    # Regenerate taskbar/installer icons from brand PNG
```

**Note:** `pnpm clean` removes all workspace `node_modules` folders. After a clean (or a fresh clone), run `pnpm install` before `pnpm dev:desktop` — otherwise `tauri` will not be found.

App icons live in `apps/desktop/src-tauri/icons/`. Source: `app-icon.png` (from `scripts/generate-deco-icon.py`, teal **D** matching UI `--primary`). After changing the logo, run `pnpm icons:generate` and restart the desktop app so Windows picks up the new `.ico`.

## Contract changes

When changing scan JSON shape:

1. Bump `SCAN_REPORT_SCHEMA_VERSION` in Rust + CLI.
2. Update [contract/changelog.md](../contract/changelog.md) and [schemas/scan-report.schema.json](../schemas/scan-report.schema.json).

## Docs

- Add or edit pages under `docs/` by **functional category**.
- Update [docs/README.md](../README.md) navigation when adding a new top-level doc.
