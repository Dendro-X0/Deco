/** Windows drive mount for a path (`G:\foo` → `G:\`). */
export function volumeMountFromPath(path: string): string | null {
  const trimmed = path.trim();
  const m = /^([A-Za-z]):/.exec(trimmed);
  if (!m) return null;
  return `${m[1].toUpperCase()}:\\`;
}

export function volumeMountsFromPaths(paths: readonly string[]): string[] {
  const mounts = new Set<string>();
  for (const p of paths) {
    const vol = volumeMountFromPath(p);
    if (vol) mounts.add(vol);
  }
  return [...mounts].sort();
}
