# Deco (Developer Compact)

A fast, safe, and interactive disk cleanup CLI for developers. Reclaim space by finding and deleting build artifacts across your projects.

## Features

- **Interactive TUI**: Easy-to-use interactive mode to select and delete targets.
- **Blazing Fast**: Parallelized scanning and size calculation.
- **Safe**: Dry-run by default. Deletion requires explicit confirmation.
- **Configurable**: Persist your preferences in a `.deco/disk-cleanup.json` file.
- **Broad Support**:
  - **Node.js**: `node_modules`, `dist`, `.next`, `.cache`, etc.
  - **Rust**: `target` directories.
  - **Go**: `bin`, `dist`, `build` directories, `GOCACHE`, and `GOMODCACHE`.
  - **Playwright**: Test results and reports.

## Installation

Install globally via **JSR**:

```bash
# Using npx
npx jsr add -g @dendro-x0/deco

# Or using deno
deno add -g jsr:@dendro-x0/deco
```

Or install via **npm**:

```bash
npm install -g @dendro-x0/deco
```

## Usage

### Running Locally

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Run (Interactive Mode)
node dist/cli.js --root "E:/Projects"

# Run (Text Report / CI Mode)
node dist/cli.js --root "E:/Projects" --dry-run
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
