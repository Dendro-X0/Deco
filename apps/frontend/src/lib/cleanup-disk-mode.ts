import type { Settings } from '../types';

export type CleanupDiskModeId = 'auto' | 'hdd' | 'standard';

export function normalizeCleanupDiskMode(raw: unknown): CleanupDiskModeId {
  const s = String(raw ?? 'auto').toLowerCase();
  if (s === 'hdd' || s === 'sequential') return 'hdd';
  if (s === 'standard' || s === 'ssd' || s === 'fast') return 'standard';
  return 'auto';
}

export function cleanupDiskModeLabel(mode: CleanupDiskModeId): string {
  switch (mode) {
    case 'hdd':
      return 'HDD / sequential';
    case 'standard':
      return 'Standard (follow scan workers)';
    default:
      return 'Auto (conservative on large batches)';
  }
}

export function cleanupDiskModeDescription(mode: CleanupDiskModeId): string {
  switch (mode) {
    case 'hdd':
      return 'Deletes one folder at a time. Best for mechanical drives and thousands of node_modules.';
    case 'standard':
      return 'Uses the same parallel worker count as Scan behavior → Performance (up to 6–8 trees at once).';
    default:
      return 'Caps parallelism on large batches and honors Low scan workers. Recommended default.';
  }
}

export function effectiveCleanupDiskMode(settings: Settings | null): CleanupDiskModeId {
  return normalizeCleanupDiskMode(settings?.cleanup_disk_mode);
}

/** Hint when a huge delete might benefit from HDD mode. */
export function suggestHddModeForSelection(
  selectedCount: number,
  mode: CleanupDiskModeId,
): boolean {
  return selectedCount > 400 && mode === 'auto';
}
