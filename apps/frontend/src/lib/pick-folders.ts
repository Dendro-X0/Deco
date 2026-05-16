import { open } from '@tauri-apps/plugin-dialog';

/** Native folder picker; returns absolute paths or null if canceled. */
export async function pickScanFolders(): Promise<string[] | null> {
  const result = await open({
    directory: true,
    multiple: true,
    title: 'Select folders to scan',
  });
  if (result === null) return null;
  const paths = (Array.isArray(result) ? result : [result]).map(String);
  return paths.map((p) => p.trim()).filter(Boolean);
}

export function normalizeRootPath(path: string): string {
  return path.trim().replace(/[\\/]+$/, '');
}

function rootKey(path: string): string {
  const n = normalizeRootPath(path);
  if (/^[a-zA-Z]:/.test(n)) return n.toLowerCase();
  return n;
}

/** Append paths without duplicates (case-insensitive on Windows drive paths). */
export function mergeScanRoots(existing: readonly string[], added: readonly string[]): string[] {
  const seen = new Set(existing.map(rootKey));
  const out = [...existing];
  for (const raw of added) {
    const path = normalizeRootPath(raw);
    if (!path) continue;
    const key = rootKey(path);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(path);
  }
  return out;
}
