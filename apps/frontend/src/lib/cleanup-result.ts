import type { TranslateFn } from '@/i18n/preset-labels';
import type { ExecuteResponse } from '@/types';
import type { ToastVariant } from '@/lib/toast';
import { formatDurationMs } from '@/lib/format';

export function formatCleanupResultSummary(
  t: TranslateFn,
  result: ExecuteResponse,
  selectedCount: number,
  durationMs?: number,
): { title: string; description: string; variant: ToastVariant } {
  const timeSuffix =
    durationMs != null && durationMs > 0
      ? t('cleanupResult.took', { duration: formatDurationMs(durationMs) })
      : '';
  const quarantined = result.quarantined_count ?? 0;
  const deleted = result.deleted_count ?? 0;
  const moved = quarantined + deleted;
  const skippedReview = result.skipped_review_count ?? 0;
  const skippedMissing = result.skipped_not_found_count ?? 0;
  const skippedOptIn = result.skipped_opt_in_count ?? 0;
  const skippedBlocked = result.skipped_blocked_count ?? 0;
  const errorCount = result.errors?.length ?? 0;

  if (moved > 0) {
    const main =
      deleted > 0 && quarantined === 0
        ? t('cleanupResult.deletedOnly', { count: deleted })
        : quarantined > 0 && deleted === 0
          ? t('cleanupResult.quarantinedOnly', { count: quarantined })
          : t('cleanupResult.mixed', { quarantined, deleted });
    const skippedParts = [
      skippedReview > 0 ? t('cleanupResult.skippedReview', { count: skippedReview }) : null,
      skippedMissing > 0 ? t('cleanupResult.skippedMissing', { count: skippedMissing }) : null,
      skippedOptIn > 0 ? t('cleanupResult.skippedOptIn', { count: skippedOptIn }) : null,
    ].filter(Boolean);
    const body = [
      main,
      skippedParts.length > 0 ? skippedParts.join('. ') : null,
      errorCount > 0 ? t('cleanupResult.errorsInStatus', { count: errorCount }) : null,
    ]
      .filter(Boolean)
      .join('. ');
    return {
      title: t('cleanupResult.complete'),
      description: body ? `${body}${timeSuffix}` : timeSuffix.trim() || body,
      variant: skippedParts.length > 0 || errorCount > 0 ? 'info' : 'default',
    };
  }

  if (selectedCount === 0) {
    return {
      title: t('cleanupResult.nothingSelected'),
      description: t('cleanupResult.nothingSelectedHint'),
      variant: 'info',
    };
  }

  if (skippedReview > 0) {
    return {
      title: t('cleanupResult.notQuarantined'),
      description: t('cleanupResult.reviewSkippedHint', { count: skippedReview }),
      variant: 'destructive',
    };
  }

  if (skippedOptIn > 0) {
    return {
      title: t('cleanupResult.notQuarantined'),
      description: t('cleanupResult.optInSkippedHint', { count: skippedOptIn }),
      variant: 'destructive',
    };
  }

  if (skippedBlocked > 0) {
    return {
      title: t('cleanupResult.notQuarantined'),
      description: t('cleanupResult.blockedSkippedHint', { count: skippedBlocked }),
      variant: 'destructive',
    };
  }

  if (errorCount > 0) {
    const first = result.errors?.[0] ?? 'Unknown error';
    return {
      title: t('cleanupResult.failed'),
      description: first,
      variant: 'destructive',
    };
  }

  return {
    title: t('cleanupResult.notQuarantined'),
    description:
      skippedMissing > 0
        ? t('cleanupResult.missingPaths', { count: skippedMissing })
        : t('cleanupResult.nothingMoved'),
    variant: 'info',
  };
}
