/** User-facing labels for Settings → delete_mode. */
export function cleanupActionLabels(deleteMode: string): {
  button: string;
  barHint: string;
  previewHint: string;
} {
  if (deleteMode === 'delete' || deleteMode === 'hard-delete') {
    return {
      button: 'Delete selected…',
      barHint: 'Deletes immediately and frees disk space (no copy)',
      previewHint: 'Selected folders will be removed from disk. This cannot be undone from Quarantine.',
    };
  }
  return {
    button: 'Move to quarantine…',
    barHint: 'Moves to your quarantine folder (see Settings — never C:\\Users\\…\\AppData by default)',
    previewHint:
      'Folders move to quarantine on the source drive or your custom folder — not to the OS AppData directory.',
  };
}
