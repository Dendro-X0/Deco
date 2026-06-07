/** Mirror of Rust `scan_root_warnings` — keep pattern ids aligned. */

export type ScanRootWarningId =
  | 'cargo_home'
  | 'rustup_home'
  | 'npm_cache'
  | 'pnpm_store'
  | 'yarn_cache'
  | 'go_mod_cache'
  | 'go_build_cache';

export type ScanRootWarning = {
  id: ScanRootWarningId;
  path: string;
};

function normPath(path: string): string {
  return path.trim().replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

type Pattern = { id: ScanRootWarningId; test: (normalized: string) => boolean };

const PATTERNS: Pattern[] = [
  {
    id: 'cargo_home',
    test: (p) => p === '.cargo' || p.endsWith('\\.cargo'),
  },
  {
    id: 'rustup_home',
    test: (p) => p === '.rustup' || p.endsWith('\\.rustup'),
  },
  {
    id: 'npm_cache',
    test: (p) => p.includes('\\appdata\\local\\npm-cache'),
  },
  {
    id: 'pnpm_store',
    test: (p) => p.includes('\\appdata\\local\\pnpm'),
  },
  {
    id: 'yarn_cache',
    test: (p) => p.includes('\\appdata\\local\\yarn'),
  },
  {
    id: 'go_mod_cache',
    test: (p) => p.includes('\\go\\pkg\\mod'),
  },
  {
    id: 'go_build_cache',
    test: (p) => p.endsWith('\\go-build'),
  },
];

export function scanRootWarning(path: string): ScanRootWarning | undefined {
  const normalized = normPath(path);
  if (!normalized) return undefined;
  for (const pattern of PATTERNS) {
    if (pattern.test(normalized)) {
      return { id: pattern.id, path: path.trim() };
    }
  }
  return undefined;
}

export function scanRootsWarnings(paths: readonly string[]): ScanRootWarning[] {
  const out: ScanRootWarning[] = [];
  const seen = new Set<string>();
  for (const p of paths) {
    const w = scanRootWarning(p);
    if (!w) continue;
    const key = `${w.id}:${w.path.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(w);
  }
  return out;
}
