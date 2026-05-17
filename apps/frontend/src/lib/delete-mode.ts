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
    barHint: 'Renames to .deco-quarantine on the same drive (restorable)',
    previewHint: 'Folders move to .deco-quarantine on the same drive — no extra copy when space is low.',
  };
}
