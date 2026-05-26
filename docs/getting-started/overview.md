# Overview

**Deco** reclaims disk space on developer machines by finding **known artifact directories** (dependencies, build outputs, caches)—not arbitrary personal files.

## Two surfaces, one policy story

| Surface | Best for |
|---------|----------|
| **Desktop** (Tauri + Rust + React) | Guided cleanup, quarantine, restore, history |
| **CLI** (Node/TypeScript) | Scripts, CI, automation, `--json` reports |

Scan semantics, risk labels (`safe` / `review` / `blocked`), and reclaim estimates should align for a given release. The [scan contract](../contract/scan-contract.md) defines the shared JSON shape.

## Safety defaults

1. **Scan first** — discover and classify before any destructive action.
2. **Quarantine-first** — desktop moves targets to a reversible quarantine store by default.
3. **Review tier** — global caches, virtualenvs, and other high-impact paths need explicit opt-in and stronger confirmation (`DELETE REVIEW` on desktop).
4. **Blocked** — system paths and protected runtimes are never deleted.

Details: [Safety model](../product/safety.md), [PROJECT.md](../../PROJECT.md).

## What Deco is not

- A general file browser or TreeSize replacement for every folder.
- An automatic cleaner for `Documents`, `Downloads`, or user media.
- A Docker/image pruning tool (out of scope unless framed separately later).

## Docker note (migration vs pruning)

Deco does **not** aim to compete with Docker’s own cleanup commands for pruning images/volumes.

However, **directory migration** for tool storage (moving large tool-managed folders off `C:` and leaving a junction/symlink behind) is a separate, bounded feature. It can help when Docker Desktop and WSL-related storage grows on the OS drive, even if “prune images” remains out of scope.

## Next steps

- [Install](install.md) from GitHub Releases
- [Quickstart](quickstart.md) — first scan
- [Desktop user guide](../desktop/user-guide.md) for the full UI flow
