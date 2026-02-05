# Deco (Developer Compact)

A fast, safe, and interactive disk cleanup CLI for developers. Reclaim space by finding and deleting build artifacts across your projects.

## Features

- **Dashboard UI**: New structured TUI with real-time scanning progress, categorized summaries, and menu-driven actions.
- **Smart Safety**: Strictly ignores system directories (`Program Files`, `AppData`, `Windows`) and Electron app runtimes (`resources/app`) to prevent breaking installed tools.
- **Parallel Deletion**: Deletes files concurrently for significantly faster performance on large folders.
- **Interactive**: Easy-to-use interactive mode to select and delete targets.
- **Blazing Fast**: Parallelized scanning and size calculation.
- **Safe**: Dry-run by default. Deletion requires explicit confirmation.
- **Configurable**: Persist your preferences in a `.deco/disk-cleanup.json` file.
- **Broad Support**:
  - **Node.js**: `node_modules`, `dist`, `.next`, `.cache`, etc.
  - **Rust**: `target` directories.
  - **Go**: `dist`, `build` directories, `GOCACHE`, and `GOMODCACHE`.
  - **Playwright**: Test results and reports.

## Quick Start (Run Locally)

You can run the tool directly from this folder without installing anything globally.

```bash
# 1. Build the project
pnpm build

# 2. Run it!
node dist/cli.js --root "C:/"
```

### Installation (Optional)

If you want to use the command `deco` from any terminal window on your machine:

```bash
# In this directory:
npm link

# Now you can just type:
deco --root "E:/"
```

### Options

| Flag | Description |
|------|-------------|
| `--root <path>` | Directory to scan (can be used multiple times). Default: CWD |
| `--interactive` | Force interactive mode (default in TTY) |
| `--dry-run` | Show text report without entering interactive mode |
| `--no-size` | Skip size calculation for faster scanning |
| `--delete` | Actually delete targets (requires `--yes`) |
| `--yes` | Confirm deletion (for non-interactive mode) |
| `--check-go-cache` | Include global Go caches |
| `--config <path>` | Path to specific config file |

## Configuration

Deco looks for a configuration file in `.deco/disk-cleanup.json` in the current directory.

```json
{
  "roots": ["E:/Projects", "D:/Work"],
  "maxDepth": 6,
  "targets": {
    "nodeModules": true,
    "buildArtifacts": true,
    "rustArtifacts": true,
    "goArtifacts": false
  },
  "excludeAbsPathContains": ["/monorepo/submodule"]
}
```

See [docs/](docs/) for more specific documentation.
