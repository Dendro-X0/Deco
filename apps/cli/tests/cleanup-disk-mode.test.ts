import { describe, expect, it } from 'vitest';
import {
  cleanupDiskModeDescription,
  cleanupDiskModeLabel,
  effectiveCleanupDiskMode,
  normalizeCleanupDiskMode,
  suggestHddModeForSelection,
} from '../../frontend/src/lib/cleanup-disk-mode';

describe('cleanup-disk-mode', () => {
  it('normalizes aliases', () => {
    expect(normalizeCleanupDiskMode('sequential')).toBe('hdd');
    expect(normalizeCleanupDiskMode('ssd')).toBe('standard');
    expect(normalizeCleanupDiskMode('unknown')).toBe('auto');
  });

  it('labels and descriptions are stable', () => {
    expect(cleanupDiskModeLabel('hdd')).toContain('HDD');
    expect(cleanupDiskModeDescription('hdd')).toMatch(/one folder/i);
  });

  it('suggests HDD mode for huge auto batches', () => {
    expect(suggestHddModeForSelection(500, 'auto')).toBe(true);
    expect(suggestHddModeForSelection(500, 'hdd')).toBe(false);
    expect(suggestHddModeForSelection(100, 'auto')).toBe(false);
  });

  it('reads mode from settings', () => {
    expect(effectiveCleanupDiskMode({ cleanup_disk_mode: 'hdd' } as never)).toBe('hdd');
  });
});
