# Batch delete UX (v0.6.7 L5)

**Manifest:** [v0.6.7-manifest.md](../product/v0.6.7-manifest.md) · **Code:** `engine/cleanup_batch.rs`, `engine/executor.rs`

Large in-place cleanups (80+ bulk trees) are split into **chunks of 40** so cancel and pause take effect between chunks instead of only after the whole batch finishes.

## Behavior

| Constant | Value |
|----------|-------|
| `CLEANUP_CHUNK_THRESHOLD` | 80 items |
| `CLEANUP_CHUNK_SIZE` | 40 items per chunk |

- **Parallel path** — items queued for parallel delete are processed chunk-by-chunk; each chunk still uses the configured delete parallelism inside the chunk.
- **Delete order** — before chunking, trees are sorted **largest first** so the first chunk starts the heaviest `node_modules` / build trees in parallel instead of leaving them for the last chunk (which felt like “fast first half, slow second half” on large SSD cleanups).
- **Sequential / HDD path** — when total candidates ≥ 80, sequential deletes also emit `chunk_boundary` every 40 folders.
- **Progress** — `chunk_boundary` stage includes chunk index, folder count, and estimated `folders/min` and `MB/s` (chunk + session overall).

## Verification

1. Select 80+ safe `node_modules` rows (fixture or real disk).
2. Start delete; observe “Chunk complete” between batches with throughput text.
3. Click **Stop** between chunks — cleanup should stop before the next chunk starts.
4. On HDD mode, pause between folders still works within a chunk; chunk boundaries add another cancel point for parallel batches.

```bash
pnpm check
cargo test -p deco-desktop cleanup_batch::
```
