import os from 'node:os';
import path from 'node:path';

export type MigrationPathRole = 'source' | 'dest';

function norm(pth: string): string {
  return path.win32.resolve(pth).toLowerCase();
}

function isUnder(child: string, parent: string): boolean {
  const c = norm(child);
  const p = norm(parent).replace(/\\+$/, '');
  if (c === p) return true;
  return c.startsWith(`${p}\\`);
}

function isDriveRoot(absPath: string): boolean {
  return /^[a-z]:\\?$/.test(norm(absPath));
}

function systemPrefixes(): string[] {
  if (process.platform !== 'win32') return [];
  return [
    process.env.SystemRoot || 'C:\\Windows',
    process.env.ProgramFiles || 'C:\\Program Files',
    process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    process.env.ProgramData || 'C:\\ProgramData',
  ];
}

function profileRootBlocklist(): string[] {
  if (process.platform !== 'win32') return [];
  const profile = process.env.USERPROFILE;
  if (!profile) return [];
  return [
    profile,
    path.join(profile, 'AppData'),
    path.join(profile, 'AppData', 'Roaming'),
    path.join(profile, 'AppData', 'Local'),
    path.join(profile, 'AppData', 'LocalLow'),
    path.join(profile, 'Documents'),
    path.join(profile, 'Desktop'),
    path.join(profile, 'Downloads'),
    path.join(profile, 'Music'),
    path.join(profile, 'Pictures'),
    path.join(profile, 'Videos'),
    path.join(profile, 'OneDrive'),
  ];
}

/** When non-null, migration must not use this path for the given role. */
export function migrationPathBlockReason(absPath: string, role: MigrationPathRole): string | null {
  if (process.platform !== 'win32') return null;

  const resolved = path.resolve(absPath);
  const roleLabel = role === 'source' ? 'source' : 'destination';

  if (isDriveRoot(resolved)) {
    return `Refusing to use drive root as migration ${roleLabel}: ${resolved}`;
  }

  for (const prefix of systemPrefixes()) {
    if (isUnder(resolved, prefix)) {
      return `Refusing to use a path under system directory ${prefix} as migration ${roleLabel}: ${resolved}`;
    }
  }

  for (const blocked of profileRootBlocklist()) {
    if (norm(resolved) === norm(blocked)) {
      return `Refusing to migrate an entire profile root (${blocked}). Pick a specific subfolder — e.g. Documents\\Electronic Arts\\The Sims 4\\Mods instead of all of Documents.`;
    }
  }

  return null;
}
