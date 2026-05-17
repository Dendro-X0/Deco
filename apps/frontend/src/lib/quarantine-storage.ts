/** True when path is on Windows system drive C: (warn in settings). */
export function isWindowsSystemDrivePath(path: string): boolean {
  const trimmed = path.trim();
  return /^[cC]:[\\/]/.test(trimmed) || /^[cC]:$/.test(trimmed);
}

export function quarantineStorageSummary(
  deleteMode: string,
  layout: string,
  customPath: string,
): string {
  if (deleteMode !== 'quarantine') {
    return 'Quarantine is off — cleanup uses Delete in place (nothing stored on disk).';
  }
  if (layout === 'custom' && customPath.trim()) {
    const onC = isWindowsSystemDrivePath(customPath);
    return onC
      ? `Custom folder on C: — ${customPath.trim()} (may use system drive space)`
      : `Custom folder — ${customPath.trim()}`;
  }
  return 'On each source drive — {drive}\\.deco-quarantine (never %AppData%)';
}
