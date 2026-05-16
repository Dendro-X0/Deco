import type { HistoryItem, Settings } from '../types';
import { normalizeSettings } from './settings-normalize';
import { volumeMountsFromPaths } from './volume-from-path';
import { volumesFromRoots } from './scan-report';

/** Partition scans use shallow roots (drive / Users / known dev folders). */
export function inferHistoryScanMode(roots: readonly string[]): 'custom' | 'partition' {
  if (roots.length === 0) return 'partition';
  return roots.every(isShallowPartitionRoot) ? 'partition' : 'custom';
}

function isShallowPartitionRoot(path: string): boolean {
  const norm = path.trim().replace(/[\\/]+$/, '');
  const parts = norm.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 1) return true;
  if (parts.length === 2 && parts[1].toLowerCase() === 'users') return true;
  if (parts.length === 3 && parts[1].toLowerCase() === 'users') {
    const dev = ['projects', 'source', 'code', 'dev', 'workspace', 'repos', 'documents'];
    return dev.includes(parts[2].toLowerCase());
  }
  return false;
}

/** Build settings to persist when reusing a history entry (does not save). */
export function settingsFromHistoryItem(item: HistoryItem, current: Settings): Settings {
  const custom = inferHistoryScanMode(item.roots) === 'custom';
  const volumes = volumesFromRoots(item.roots);
  const mountsFromCustom = volumeMountsFromPaths(item.roots);

  const selected_volumes = custom
    ? [...new Set([...volumes, ...mountsFromCustom])].sort()
    : volumes.length > 0
      ? volumes
      : (current.selected_volumes ?? []);

  return normalizeSettings({
    ...current,
    profile: item.profile,
    stale_days: item.stale_days,
    use_custom_scan_roots: custom,
    roots: custom ? [...item.roots] : current.roots,
    selected_volumes,
    include_project_folders: custom ? false : (current.include_project_folders ?? true),
  });
}

export function historyReuseError(_item: HistoryItem, next: Settings): string | null {
  if (next.use_custom_scan_roots) {
    if (next.roots.length === 0) return 'This scan used custom folders but no paths were stored.';
    if ((next.selected_volumes ?? []).length === 0) {
      return 'Could not map custom folder paths to drive letters.';
    }
    return null;
  }
  if ((next.selected_volumes ?? []).length === 0) {
    return 'Could not map history roots to drive letters.';
  }
  return null;
}
