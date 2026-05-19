import { formatBytes, formatDurationMs } from './format';
import { humanizeKind, type KindStatRow } from './scan-statistics';
import type { Candidate, ExecuteResponse } from '@/types';

export type CleanupLiveProgress = {
  foldersDone: number;
  freedBytes: number;
  totalFolders: number;
  plannedBytes: number;
};

export type CleanupRunSummary = {
  result: ExecuteResponse;
  durationMs: number;
  requestedCount: number;
  removedKinds: KindStatRow[];
};

export function sumCandidateBytes(candidates: readonly Candidate[]): number {
  return candidates.reduce((sum, c) => sum + (c.size_bytes ?? 0), 0);
}

export function topKindsFromCandidates(
  candidates: readonly Candidate[],
  limit = 6,
): KindStatRow[] {
  const byKind = new Map<string, { count: number; bytes: number }>();
  for (const c of candidates) {
    const kind = c.kind || 'unknown';
    const row = byKind.get(kind) ?? { count: 0, bytes: 0 };
    row.count += 1;
    row.bytes += c.size_bytes ?? 0;
    byKind.set(kind, row);
  }
  return Array.from(byKind.entries())
    .map(([kind, totals]) => ({
      kind,
      label: humanizeKind(kind),
      count: totals.count,
      bytes: totals.bytes,
    }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.bytes - a.bytes || b.count - a.count)
    .slice(0, limit);
}

export function formatCleanupLiveLine(live: CleanupLiveProgress): string {
  const freed = formatBytes(live.freedBytes);
  const folders =
    live.totalFolders > 0
      ? `${live.foldersDone}/${live.totalFolders} folders`
      : `${live.foldersDone} folders`;
  if (live.plannedBytes > 0 && live.freedBytes > 0) {
    const pct = Math.min(99, Math.round((live.freedBytes / live.plannedBytes) * 100));
    return `Freed ${freed} · ${folders} · ~${pct}% of selected size`;
  }
  return `Freed ${freed} · ${folders}`;
}

export function formatCleanupRunHeadline(summary: CleanupRunSummary): string {
  const { result, durationMs } = summary;
  const freed = result.freed_bytes ?? 0;
  const moved = (result.deleted_count ?? 0) + (result.quarantined_count ?? 0);
  const time =
    durationMs > 0 ? ` · ${formatDurationMs(durationMs)}` : '';
  if (freed > 0 && moved > 0) {
    return `Freed ${formatBytes(freed)} · ${moved} folder(s)${time}`;
  }
  if (moved > 0) {
    return `${moved} folder(s) processed${time}`;
  }
  return `Cleanup finished${time}`;
}

/** Localized headline for CleanupStatisticsCard. */
export function formatCleanupRunHeadlineLocalized(
  t: (key: string, vars?: Record<string, string | number>) => string,
  summary: CleanupRunSummary,
): string {
  const { result, durationMs } = summary;
  const freed = result.freed_bytes ?? 0;
  const moved = (result.deleted_count ?? 0) + (result.quarantined_count ?? 0);
  const time = durationMs > 0 ? ` · ${formatDurationMs(durationMs)}` : '';
  if (freed > 0 && moved > 0) {
    return t('dashboard.cleanupStats.headlineFreed', {
      size: formatBytes(freed),
      count: moved,
      time,
    });
  }
  if (moved > 0) {
    return t('dashboard.cleanupStats.headlineProcessed', { count: moved, time });
  }
  return t('dashboard.cleanupStats.headlineFinished', { time });
}

export function formatCleanupDiagnostics(summary: CleanupRunSummary): string {
  const { result, durationMs, requestedCount, removedKinds } = summary;
  const lines = [
    'Deco cleanup diagnostics',
    formatCleanupRunHeadline(summary),
    `Requested: ${requestedCount}`,
    `Deleted: ${result.deleted_count ?? 0}`,
    `Quarantined: ${result.quarantined_count ?? 0}`,
    `Freed (estimated): ${formatBytes(result.freed_bytes ?? 0)}`,
    `Skipped review: ${result.skipped_review_count ?? 0}`,
    `Skipped missing: ${result.skipped_not_found_count ?? 0}`,
    `Skipped opt-in: ${result.skipped_opt_in_count ?? 0}`,
    `Skipped blocked: ${result.skipped_blocked_count ?? 0}`,
    durationMs > 0 ? `Duration: ${formatDurationMs(durationMs)}` : null,
    removedKinds.length > 0
      ? `Top kinds: ${removedKinds.map((k) => `${k.label} ${k.count} (${formatBytes(k.bytes)})`).join('; ')}`
      : null,
    result.errors?.length ? `Errors: ${result.errors.join(' | ')}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}
