/** Shown on Dashboard metrics before any scan has completed. */
export const NO_SCAN_BYTES_LABEL = '-.-- B';

/** Shown when sizing did not finish for a candidate (canceled, timeout, missing path). */
export const SIZE_NOT_CALCULATED_LABEL = 'Not calculated';

export function formatBytes(bytes = 0): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(2)} ${units[idx]}`;
}

/** Dashboard stat cards: placeholder until a scan finishes, then real bytes (including 0). */
export function formatStatBytes(
  bytes: number | undefined,
  hasScanResults: boolean,
): string {
  if (!hasScanResults) return NO_SCAN_BYTES_LABEL;
  return formatBytes(bytes ?? 0);
}

/** True when backend has reported an explicit byte size for this candidate (including 0 for empty dirs). */
export function candidateSizeIsKnown(bytes: number | undefined): bytes is number {
  return typeof bytes === 'number' && !Number.isNaN(bytes);
}

export function candidateSizeIsEstimated(reasonCodes?: string[]): boolean {
  return reasonCodes?.includes('size_estimated') ?? false;
}

/** Table/detail size cell: known bytes, in-progress label, or not calculated after scan ends. */
export function formatCandidateSize(
  bytes: number | undefined,
  scanActive: boolean,
  estimated = false,
): string {
  if (candidateSizeIsKnown(bytes)) {
    const label = formatBytes(bytes);
    return estimated ? `~${label}` : label;
  }
  if (scanActive) return 'Sizing…';
  return SIZE_NOT_CALCULATED_LABEL;
}

/**
 * Short path for dense tables: keeps drive/root + last segments so size columns stay visible.
 * Full path should still be passed via `title`.
 */
export function compactListPath(absPath: string, maxChars = 56): string {
  const norm = absPath.replace(/\\/g, '/').trim();
  if (norm.length <= maxChars) return norm;
  const parts = norm.split('/').filter(Boolean);
  if (parts.length <= 2) {
    return `…${norm.slice(-(maxChars - 1))}`;
  }
  const head =
    parts[0].length <= 3 && parts[0].endsWith(':')
      ? `${parts[0]}/${parts[1] ?? ''}`
      : parts[0];
  const tail = parts.slice(-2).join('/');
  let compact = `${head}/…/${tail}`;
  if (compact.length > maxChars) {
    compact = `…/${parts.slice(-3).join('/')}`;
  }
  if (compact.length > maxChars) {
    return `…${norm.slice(-(maxChars - 1))}`;
  }
  return compact;
}

/** Compact duration for status lines (e.g. `45s`, `2m 15s`, `1h 5m`). */
export function formatDurationMs(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m < 60) return sec > 0 ? `${m}m ${sec}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}
