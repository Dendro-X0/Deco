# Milestone 1 — Reliability + scan quality

This milestone hardens **filesystem traversal**, **progress reporting**, and **duplicate-path** behavior so scans finish with stable totals even when trees contain symlinks, junctions, permission errors, or overlapping roots.

## Behavior (CLI + desktop engine)

### Windows paths and duplicate roots

- **CLI** (`apps/cli`): `dedupeScanRoots()` deduplicates `--root` values after `path.resolve`, using **case-insensitive** keys on Windows so `E:\foo` and `e:\foo` are scanned once.
- **Rust** (`apps/desktop/src-tauri`): `dedupe_roots()` uses `canonicalize` when possible (with a Windows lowercase fallback) so equivalent roots are not scanned twice.

### Permission and walk errors

- **CLI**: `readdir` / `lstat` failures append to the same **`errors`** list used today (printed as “Warnings” in human output). The scan continues for other branches.
- **Rust**: `WalkDir` `Err` entries append to **`warnings`** instead of being dropped. **`dir_size_bytes`** returns `(bytes, warnings)` for non-fatal size-walk errors; the scan command merges them into the response **`warnings`** vector.

### Symbolic links and junctions

- **Traversal**: `walkdir` uses **`follow_links(false)`** so symlink cycles are not followed during discovery or sizing.
- **CLI discovery**: When a child directory entry is a **symbolic link** (`lstat.isSymbolicLink()`), Deco **does not recurse** into it (avoids escaping the scan root or hitting cycles). A **named target** that is itself a symlink (e.g. `node_modules` → store) is still **recorded** as a candidate; `mtime` uses `stat` (follows the link).
- **Sizing (CLI)**: `getDirSizeBytes` tracks **visited canonical paths** so a graph of symlinks does not double-count or loop.
- **Windows directory junctions** are often not reported as symlinks; **canonical deduplication** of discovered targets still collapses two paths that resolve to the same directory.

### Duplicate targets (no double-delete)

- After discovery (including optional Go cache paths), targets are deduplicated by **`realpath` / `canonicalize`**. The second and later paths to the same inode emit a short note (CLI: `errors` list; Rust: `warnings`).

### Nested monorepos

- Each row remains a **single absolute path** after dedupe. **`projectRoot`** (from project detection in the classifier) identifies the nearest repo root for explanation—there is no separate “group” row; clarity comes from **path + `projectRoot`**, not ambiguous duplicate `absPath` rows.

### Progress (CLI)

- `ProgressUpdate` may include **`phase`**: `discover` | `classify` | `size`, and during **`size`**, **`sizedCandidates`** (start `0`, end total). The interactive spinner shows these phases.

## Verification

```bash
pnpm -F @dendro-x0/deco-cli test
cd apps/desktop/src-tauri && cargo test
```

On **Unix**, `engine::scanner::tests::dedupes_node_modules_seen_via_symlink_and_real_path` asserts canonical dedupe across a symlinked `node_modules`.

## References

- Roadmap: `ROADMAP.md` (Milestone 1)
- Prior baseline: [milestone-0.md](milestone-0.md)
