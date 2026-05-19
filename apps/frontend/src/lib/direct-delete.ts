import type { TranslateFn } from '@/i18n/preset-labels';
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

export function directDeleteConfirmDescription(
  t: TranslateFn,
  stats: DirectDeleteSelectionStats,
): string {
  if (stats.safeCount === 0) {
    return t('directDelete.noSafeSelected');
  }

  const parts: string[] = [
    t('directDelete.confirmIntro', {
      count: stats.safeCount,
      size: formatBytes(stats.safeBytes),
    }),
    t('directDelete.confirmWarning'),
  ];

  if (stats.reviewCount > 0) {
    parts.push(t('directDelete.reviewSkipped', { count: stats.reviewCount }));
  }
  if (stats.blockedCount > 0) {
    parts.push(t('directDelete.blockedSkipped', { count: stats.blockedCount }));
  }

  return parts.join(' ');
}

export function canConfirmDirectDelete(stats: DirectDeleteSelectionStats): boolean {
  return stats.safeCount > 0;
}
