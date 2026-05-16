/** Why header / planner cleanup actions are disabled (null = enabled). */

export function cleanSelectedDisabledReason(opts: {
  selectedCount: number;
  scanning: boolean;
  busy: boolean;
  hasScanResults: boolean;
}): string | null {
  if (opts.busy) return 'Wait for the current operation to finish.';
  if (opts.scanning) return 'Wait for the scan to finish before cleaning.';
  if (!opts.hasScanResults) return 'Run a scan first, then select candidates to clean.';
  if (opts.selectedCount === 0) return 'Select one or more candidates in the table first.';
  return null;
}

export function settingsSaveDisabledReason(opts: {
  dirty: boolean;
  saving: boolean;
  scanning: boolean;
}): string | null {
  if (opts.scanning) return 'Cannot save while a scan is running.';
  if (opts.saving) return 'Saving…';
  if (!opts.dirty) return 'No changes to save.';
  return null;
}

export function settingsDiscardDisabledReason(opts: {
  dirty: boolean;
  saving: boolean;
  scanning: boolean;
}): string | null {
  if (opts.scanning) return 'Cannot discard while a scan is running.';
  if (opts.saving) return 'Wait until save completes.';
  if (!opts.dirty) return 'No changes to discard.';
  return null;
}
