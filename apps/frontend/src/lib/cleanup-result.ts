import type { ExecuteResponse } from '@/types';
import type { ToastVariant } from '@/lib/toast';
import { formatDurationMs } from '@/lib/format';

export function formatCleanupResultSummary(
  result: ExecuteResponse,
  selectedCount: number,
  durationMs?: number,
): { title: string; description: string; variant: ToastVariant } {
  const timeSuffix =
    durationMs != null && durationMs > 0 ? ` Took ${formatDurationMs(durationMs)}.` : '';
  const quarantined = result.quarantined_count ?? 0;
  const deleted = result.deleted_count ?? 0;
  const moved = quarantined + deleted;
  const skippedReview = result.skipped_review_count ?? 0;
  const skippedMissing = result.skipped_not_found_count ?? 0;
  const skippedOptIn = result.skipped_opt_in_count ?? 0;
  const skippedBlocked = result.skipped_blocked_count ?? 0;
  const errorCount = result.errors?.length ?? 0;

  if (moved > 0) {
    const parts = [
      deleted > 0 && quarantined === 0
        ? `${deleted} deleted (freed space immediately)`
        : quarantined > 0 && deleted === 0
          ? `${quarantined} moved to quarantine`
          : `${quarantined} quarantined, ${deleted} deleted in place`,
    ].filter(Boolean);
    const skippedParts = [
      skippedReview > 0 ? `${skippedReview} review-tier skipped (enable in preview)` : null,
      skippedMissing > 0 ? `${skippedMissing} already missing` : null,
      skippedOptIn > 0 ? `${skippedOptIn} need opt-in in Settings` : null,
    ].filter(Boolean);
    const body = [
      parts.join(', '),
      skippedParts.length > 0 ? skippedParts.join('. ') : null,
      errorCount > 0 ? `${errorCount} error(s) — see status bar` : null,
    ]
      .filter(Boolean)
      .join('. ');
    return {
      title: 'Cleanup complete',
      description: body ? `${body}${timeSuffix}` : timeSuffix.trim() || body,
      variant: skippedParts.length > 0 || errorCount > 0 ? 'info' : 'default',
    };
  }

  if (selectedCount === 0) {
    return {
      title: 'Nothing selected',
      description: 'Select candidates in the results table, then use Clean selected.',
      variant: 'info',
    };
  }

  if (skippedReview > 0) {
    return {
      title: 'No items quarantined',
      description: `${skippedReview} review-tier item(s) were skipped. In the preview dialog, check “Include review-tier items” and type DELETE REVIEW to confirm.`,
      variant: 'destructive',
    };
  }

  if (skippedOptIn > 0) {
    return {
      title: 'No items quarantined',
      description: `${skippedOptIn} global-cache item(s) need matching toggles under Settings → Discovery, then re-scan.`,
      variant: 'destructive',
    };
  }

  if (skippedBlocked > 0) {
    return {
      title: 'No items quarantined',
      description: `${skippedBlocked} blocked item(s) cannot be removed. Deselect them and try again.`,
      variant: 'destructive',
    };
  }

  if (errorCount > 0) {
    const first = result.errors?.[0] ?? 'Unknown error';
    return {
      title: 'Cleanup failed',
      description: first,
      variant: 'destructive',
    };
  }

  return {
    title: 'No items quarantined',
    description:
      skippedMissing > 0
        ? `${skippedMissing} path(s) no longer exist on disk.`
        : 'Nothing was moved. Re-run the scan if paths changed.',
    variant: 'info',
  };
}
