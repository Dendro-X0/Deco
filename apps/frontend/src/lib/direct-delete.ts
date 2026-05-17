import { formatBytes } from './format';
import type { Candidate } from '../types';

export type DirectDeleteSelectionStats = {
  safeCount: number;
  safeBytes: number;
  reviewCount: number;
  blockedCount: number;
  totalSelected: number;
};

export function directDeleteSelectionStats(
  candidates: readonly Candidate[],
  selectedIds: ReadonlySet<string>,
): DirectDeleteSelectionStats {
  let safeCount = 0;
  let safeBytes = 0;
  let reviewCount = 0;
  let blockedCount = 0;
  for (const c of candidates) {
    if (!selectedIds.has(c.id)) continue;
    if (c.risk === 'safe') {
      safeCount += 1;
      safeBytes += c.size_bytes ?? 0;
    } else if (c.risk === 'review') {
      reviewCount += 1;
    } else if (c.risk === 'blocked') {
      blockedCount += 1;
    }
  }
  return {
    safeCount,
    safeBytes,
    reviewCount,
    blockedCount,
    totalSelected: safeCount + reviewCount + blockedCount,
  };
}

export function directDeleteConfirmDescription(stats: DirectDeleteSelectionStats): string {
  if (stats.safeCount === 0) {
    return 'No safe-tier items are selected. Permanent delete only applies to safe-tier folders. Use “Move to quarantine…” for review-tier items, or change your selection.';
  }

  const parts: string[] = [
    `Permanently delete ${stats.safeCount} folder${stats.safeCount === 1 ? '' : 's'} (${formatBytes(stats.safeBytes)})?`,
    'Files are removed from disk immediately — not moved to quarantine — and cannot be restored from Deco.',
  ];

  if (stats.reviewCount > 0) {
    parts.push(
      `${stats.reviewCount} review-tier item${stats.reviewCount === 1 ? '' : 's'} in your selection will be skipped.`,
    );
  }
  if (stats.blockedCount > 0) {
    parts.push(
      `${stats.blockedCount} blocked item${stats.blockedCount === 1 ? '' : 's'} cannot be deleted.`,
    );
  }

  return parts.join(' ');
}

export function canConfirmDirectDelete(stats: DirectDeleteSelectionStats): boolean {
  return stats.safeCount > 0;
}
