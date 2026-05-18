import { describe, expect, it } from 'vitest';
import { formatCleanupLiveLine } from '../../frontend/src/lib/cleanup-statistics';
import {
  cleanupProgressToScanProgress,
  readCleanupLiveProgress,
} from '../../frontend/src/lib/cleanup-progress';

describe('cleanup-statistics', () => {
  it('formats live freed bytes and folder count', () => {
    const line = formatCleanupLiveLine({
      foldersDone: 42,
      freedBytes: 67_200_000_000,
      totalFolders: 87,
      plannedBytes: 72_000_000_000,
    });
    expect(line).toContain('folders');
    expect(line).toContain('42/87');
    expect(line).toMatch(/GB/);
  });
});

describe('cleanup-progress live', () => {
  it('maps backend progress fields to live stats', () => {
    const live = readCleanupLiveProgress(
      {
        index: 10,
        total: 87,
        abs_path: 'E:\\p\\node_modules',
        action: 'delete',
        stage: 'fast_remove_tree',
        freed_bytes_so_far: 1_000_000,
        folders_done_so_far: 5,
      },
      { totalFolders: 87, plannedBytes: 10_000_000 },
    );
    expect(live).toEqual({
      foldersDone: 5,
      freedBytes: 1_000_000,
      totalFolders: 87,
      plannedBytes: 10_000_000,
    });
    const progress = cleanupProgressToScanProgress(
      {
        index: 10,
        total: 87,
        abs_path: 'E:\\p\\node_modules',
        action: 'delete',
        stage: 'fast_remove_tree',
        freed_bytes_so_far: 1_000_000,
        folders_done_so_far: 5,
      },
      50,
      live,
    );
    expect(progress.cleanupLive?.foldersDone).toBe(5);
    expect(progress.detail).toContain('folders');
  });
});
