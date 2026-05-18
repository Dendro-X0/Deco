import { describe, expect, it } from 'vitest';
import { formatCleanupProgress } from '../../frontend/src/lib/cleanup-progress';

describe('cleanup-progress', () => {
  it('shows chunk boundary throughput detail', () => {
    const { text, detail } = formatCleanupProgress({
      index: 80,
      total: 200,
      abs_path: '',
      action: 'delete',
      stage: 'chunk_boundary',
      completed_count: 80,
      detail:
        'Chunk 1/3 finished (40 folders). ~120 folders/min · ~45.2 MB/s. Overall: ~100 folders/min',
    });
    expect(text).toContain('Chunk complete');
    expect(detail).toContain('Chunk 1/3');
    expect(detail).toContain('folders/min');
  });

  it('explains node_modules slowness on remove_tree stage', () => {
    const { text, detail } = formatCleanupProgress({
      index: 1,
      total: 1,
      abs_path: 'E:\\proj\\node_modules',
      action: 'delete',
      stage: 'remove_tree',
      kind: 'node_modules',
    });
    expect(text).toContain('node_modules');
    expect(detail).toContain('thousands of small files');
  });
});
