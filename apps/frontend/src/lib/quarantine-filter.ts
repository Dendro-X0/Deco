import type { QuarantineEntry } from '../types';
import { parseSizeInput } from './candidate-filter';
import {
  HISTORY_TIME_RANGE_OPTIONS,
  timeRangeWindowMs,
  type HistoryTimeRange,
} from './history-filter';
import { volumeMountFromPath } from './volume-from-path';

export { HISTORY_TIME_RANGE_OPTIONS };
export type { HistoryTimeRange };

export type QuarantineFilterState = {
  searchQuery: string;
  sizeMinBytes: number | null;
  sizeMaxBytes: number | null;
  timeRange: HistoryTimeRange;
  volumeMount: string;
  onlyPurgeEligible: boolean;
};

export const EMPTY_QUARANTINE_FILTERS: QuarantineFilterState = {
  searchQuery: '',
  sizeMinBytes: null,
  sizeMaxBytes: null,
  timeRange: 'all',
  volumeMount: 'all',
  onlyPurgeEligible: false,
};

export function quarantineFilterFromInputs(
  searchInput: string,
  sizeMinInput: string,
  sizeMaxInput: string,
  timeRange: HistoryTimeRange,
  volumeMount: string,
  onlyPurgeEligible: boolean,
): QuarantineFilterState {
  return {
    searchQuery: searchInput.trim().toLowerCase(),
    sizeMinBytes: parseSizeInput(sizeMinInput),
    sizeMaxBytes: parseSizeInput(sizeMaxInput),
    timeRange,
    volumeMount: volumeMount.trim() || 'all',
    onlyPurgeEligible,
  };
}

export function uniqueQuarantineVolumes(entries: readonly QuarantineEntry[]): string[] {
  const mounts = new Set<string>();
  for (const entry of entries) {
    const vol = volumeMountFromPath(entry.original_path);
    if (vol) mounts.add(vol);
  }
  return Array.from(mounts).sort();
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Days until retention allows purge; 0 = eligible now. */
export function daysUntilPurgeEligible(
  timestampIso: string,
  retentionDays: number,
  referenceMs: number = Date.now(),
): number {
  const ts = new Date(timestampIso).getTime();
  if (!Number.isFinite(ts)) return retentionDays;
  const ageDays = (referenceMs - ts) / MS_PER_DAY;
  if (ageDays >= retentionDays) return 0;
  return Math.ceil(retentionDays - ageDays);
}

export function isPurgeEligible(
  timestampIso: string,
  retentionDays: number,
  referenceMs: number = Date.now(),
): boolean {
  return daysUntilPurgeEligible(timestampIso, retentionDays, referenceMs) === 0;
}

export function filterQuarantineEntries(
  entries: readonly QuarantineEntry[],
  filters: QuarantineFilterState,
  retentionDays: number,
  referenceMs: number = Date.now(),
): QuarantineEntry[] {
  const windowMs = timeRangeWindowMs(filters.timeRange);
  const cutoffMs = windowMs !== null ? referenceMs - windowMs : null;
  const hasSearch = filters.searchQuery.length > 0;
  const hasSize = filters.sizeMinBytes !== null || filters.sizeMaxBytes !== null;
  const hasTime = cutoffMs !== null;
  const hasVolume = filters.volumeMount !== 'all' && filters.volumeMount.length > 0;

  if (
    !hasSearch &&
    !hasSize &&
    !hasTime &&
    !hasVolume &&
    !filters.onlyPurgeEligible
  ) {
    return [...entries];
  }

  return entries.filter((entry) => {
    if (filters.onlyPurgeEligible && !isPurgeEligible(entry.timestamp_iso, retentionDays, referenceMs)) {
      return false;
    }

    if (hasSearch) {
      const hay = `${entry.id} ${entry.original_path} ${entry.quarantined_path ?? ''}`.toLowerCase();
      if (!hay.includes(filters.searchQuery)) return false;
    }

    if (hasSize) {
      const bytes = entry.size_bytes ?? 0;
      if (filters.sizeMinBytes !== null && bytes < filters.sizeMinBytes) return false;
      if (filters.sizeMaxBytes !== null && bytes > filters.sizeMaxBytes) return false;
    }

    if (hasTime && cutoffMs !== null) {
      const createdMs = new Date(entry.timestamp_iso).getTime();
      if (!Number.isFinite(createdMs) || createdMs < cutoffMs) return false;
    }

    if (hasVolume) {
      const vol = volumeMountFromPath(entry.original_path);
      if (vol !== filters.volumeMount) return false;
    }

    return true;
  });
}

export function quarantineFiltersActive(filters: QuarantineFilterState): boolean {
  return (
    filters.searchQuery.length > 0 ||
    filters.sizeMinBytes !== null ||
    filters.sizeMaxBytes !== null ||
    filters.timeRange !== 'all' ||
    (filters.volumeMount !== 'all' && filters.volumeMount.length > 0) ||
    filters.onlyPurgeEligible
  );
}

export function countPurgeEligible(
  entries: readonly QuarantineEntry[],
  retentionDays: number,
  referenceMs: number = Date.now(),
): number {
  return entries.filter((e) => isPurgeEligible(e.timestamp_iso, retentionDays, referenceMs)).length;
}
