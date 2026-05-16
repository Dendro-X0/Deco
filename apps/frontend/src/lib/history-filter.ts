import type { HistoryItem } from '../types';
import { parseSizeInput } from './candidate-filter';
import { volumesFromRoots } from './scan-report';

export type HistoryTimeRange = 'all' | '1h' | '24h' | '7d' | '30d';

export const HISTORY_TIME_RANGE_OPTIONS: { value: HistoryTimeRange; label: string }[] = [
  { value: 'all', label: 'Any time' },
  { value: '1h', label: 'Past 1 hour' },
  { value: '24h', label: 'Past 24 hours' },
  { value: '7d', label: 'Past 7 days' },
  { value: '30d', label: 'Past 30 days' },
];

const MS_PER_HOUR = 60 * 60 * 1000;

export type HistoryFilterState = {
  sizeMinBytes: number | null;
  sizeMaxBytes: number | null;
  timeRange: HistoryTimeRange;
  volumeMount: string;
};

export const EMPTY_HISTORY_FILTERS: HistoryFilterState = {
  sizeMinBytes: null,
  sizeMaxBytes: null,
  timeRange: 'all',
  volumeMount: 'all',
};

export function historyFilterFromInputs(
  sizeMinInput: string,
  sizeMaxInput: string,
  timeRange: HistoryTimeRange,
  volumeMount: string,
): HistoryFilterState {
  return {
    sizeMinBytes: parseSizeInput(sizeMinInput),
    sizeMaxBytes: parseSizeInput(sizeMaxInput),
    timeRange,
    volumeMount: volumeMount.trim() || 'all',
  };
}

export function timeRangeWindowMs(range: HistoryTimeRange): number | null {
  switch (range) {
    case '1h':
      return MS_PER_HOUR;
    case '24h':
      return 24 * MS_PER_HOUR;
    case '7d':
      return 7 * 24 * MS_PER_HOUR;
    case '30d':
      return 30 * 24 * MS_PER_HOUR;
    default:
      return null;
  }
}

export function uniqueHistoryVolumes(items: readonly HistoryItem[]): string[] {
  const mounts = new Set<string>();
  for (const item of items) {
    for (const vol of volumesFromRoots(item.roots)) {
      mounts.add(vol);
    }
  }
  return Array.from(mounts).sort();
}

export function filterHistoryItems(
  items: readonly HistoryItem[],
  filters: HistoryFilterState,
  referenceMs: number = Date.now(),
): HistoryItem[] {
  const windowMs = timeRangeWindowMs(filters.timeRange);
  const cutoffMs = windowMs !== null ? referenceMs - windowMs : null;
  const hasSize =
    filters.sizeMinBytes !== null || filters.sizeMaxBytes !== null;
  const hasTime = cutoffMs !== null;
  const hasVolume = filters.volumeMount !== 'all' && filters.volumeMount.length > 0;

  if (!hasSize && !hasTime && !hasVolume) {
    return [...items];
  }

  return items.filter((item) => {
    if (hasSize) {
      const bytes = item.total_bytes ?? 0;
      if (filters.sizeMinBytes !== null && bytes < filters.sizeMinBytes) return false;
      if (filters.sizeMaxBytes !== null && bytes > filters.sizeMaxBytes) return false;
    }

    if (hasTime && cutoffMs !== null) {
      const createdMs = new Date(item.created_at).getTime();
      if (!Number.isFinite(createdMs) || createdMs < cutoffMs) return false;
    }

    if (hasVolume) {
      const mounts = volumesFromRoots(item.roots);
      if (!mounts.includes(filters.volumeMount)) return false;
    }

    return true;
  });
}

export function historyFiltersActive(filters: HistoryFilterState): boolean {
  return (
    filters.sizeMinBytes !== null ||
    filters.sizeMaxBytes !== null ||
    filters.timeRange !== 'all' ||
    (filters.volumeMount !== 'all' && filters.volumeMount.length > 0)
  );
}
