const DISMISS_KEY = 'deco.quickUpdateRecommend.dismissed';

export function isQuickUpdateHintDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissQuickUpdateHint(): void {
  try {
    localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* private mode */
  }
}

/** Show Quick update nudge after at least one completed scan and inventory enabled. */
export function shouldRecommendQuickUpdate(opts: {
  incrementalInventoryEnabled: boolean;
  completedScanCount: number;
  scanning: boolean;
  dismissed?: boolean;
}): boolean {
  if (opts.dismissed ?? isQuickUpdateHintDismissed()) return false;
  if (!opts.incrementalInventoryEnabled) return false;
  if (opts.scanning) return false;
  return opts.completedScanCount >= 1;
}
