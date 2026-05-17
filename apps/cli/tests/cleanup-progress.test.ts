import { describe, expect, it } from 'vitest';
import { formatCleanupProgress } from '../../frontend/src/lib/cleanup-progress';

describe('cleanup-progress', () => {
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
