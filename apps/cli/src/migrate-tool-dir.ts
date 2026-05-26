import { execSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { TaskQueue } from './concurrency.js';
import { getDirSizeBytes } from './scan.js';
import { lstat, mkdir, mkdtemp, readdir, realpath, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import {
  isToolMigrationPlanOnly,
  parseMigrateToolId,
  resolveToolDefaultSource,
  resolveToolDestLeaf,
  type MigrateToolId,
} from './tool-migration-profiles.js';

export type { MigrateToolId } from './tool-migration-profiles.js';
export type MigrationAction = 'plan' | 'run';

export type MigrationPlan = {
  readonly ok: boolean;
  readonly tool?: MigrateToolId;
  readonly source: string;
  readonly dest: string;
  readonly destRoot?: string;
  readonly bytes?: number;
  readonly fileCount?: number;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
  readonly planOnly?: boolean;
};

export type MigrationResult = {
  readonly ok: boolean;
  readonly source: string;
  readonly dest: string;
  readonly backupPath?: string;
  readonly auditLogPath?: string;
  readonly warnings: readonly string[];
  readonly errors: readonly string[];
};

function isWindows(): boolean {
  return process.platform === 'win32';
}

function nowStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function isDriveRoot(absPath: string): boolean {
  const resolved = path.win32.resolve(absPath);
  return /^[A-Za-z]:\\?$/.test(resolved);
}

function normalizeForPrefixCompare(pth: string): string {
  const r = path.resolve(pth);
  return isWindows() ? r.toLowerCase() : r;
}

function isUnder(child: string, parent: string): boolean {
  const c = normalizeForPrefixCompare(child);
  const p = normalizeForPrefixCompare(parent);
  if (c === p) return true;
  return c.startsWith(p.endsWith(path.sep) ? p : `${p}${path.sep}`);
}

function getBlockedPrefixesWindows(): string[] {
  const systemRoot = process.env.SystemRoot || 'C:\\Windows';
  const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
  const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const programData = process.env.ProgramData || 'C:\\ProgramData';
  const userProfile = process.env.USERPROFILE;
  return [systemRoot, programFiles, programFilesX86, programData, userProfile].filter(Boolean) as string[];
}

function readWindowsVolumeFilesystem(driveLetter: string): string | null {
  const letter = driveLetter.toUpperCase();
  try {
    const out = execSync(
      `powershell -NoProfile -Command "(Get-Volume -DriveLetter ${letter} -ErrorAction Stop).FileSystemType"`,
      { encoding: 'utf8', timeout: 15_000 },
    ).trim();
    if (out) return out;
  } catch {
    // fsutil often needs elevation; try WMIC then fsutil.
  }
  try {
    const out = execSync(`wmic logicaldisk where "DeviceID='${letter}:'" get FileSystem`, {
      encoding: 'utf8',
      timeout: 15_000,
    });
    const match = /(NTFS|FAT32|exFAT|ReFS)/i.exec(out);
    if (match) return match[1]!;
  } catch {
    // continue
  }
  try {
    const out = execSync(`fsutil fsinfo volumeinfo ${letter}:\\`, { encoding: 'utf8', timeout: 15_000 });
    const fsName = /File System Name\s*:\s*(\S+)/i.exec(out)?.[1];
    if (fsName) return fsName;
    if (/NTFS/i.test(out)) return 'NTFS';
  } catch {
    // continue
  }
  return null;
}

function destRequiresNtfs(destAbs: string): string | null {
  const m = /^([A-Za-z]):/.exec(path.resolve(destAbs));
  if (!m) return 'Could not determine drive letter for destination (junction requires NTFS).';
  const fsType = readWindowsVolumeFilesystem(m[1]!);
  if (!fsType) {
    return 'Could not verify destination filesystem (NTFS required for junction).';
  }
  if (!/^NTFS$/i.test(fsType)) {
    return `Destination volume uses "${fsType}" (junction migration requires NTFS).`;
  }
  return null;
}

function isBlockedSource(sourceAbs: string): string | null {
  if (isDriveRoot(sourceAbs)) return 'Refusing to migrate a drive root.';

  const resolved = path.resolve(sourceAbs);
  for (const pref of getBlockedPrefixesWindows()) {
    const prefResolved = path.resolve(pref);
    // We DO allow migrating AppData subfolders (Cursor/Code) which are under USERPROFILE;
    // but we refuse profile root itself and other broad parents.
    if (normalizeForPrefixCompare(resolved) === normalizeForPrefixCompare(prefResolved)) {
      return `Refusing to migrate a protected root: ${prefResolved}`;
    }
  }
  return null;
}

async function existsDir(absPath: string): Promise<boolean> {
  try {
    const st = await stat(absPath);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function isSymlinkOrJunction(absPath: string): Promise<boolean> {
  try {
    const st = await lstat(absPath);
    return st.isSymbolicLink();
  } catch {
    return false;
  }
}

async function countFiles(absPath: string, queue: TaskQueue): Promise<number> {
  let total = 0;
  const st = await queue.run(() => stat(absPath));
  if (!st.isDirectory()) return 1;

  const entries = await queue.run(() => readdir(absPath, { withFileTypes: true }));
  const tasks = entries.map(async (entry) => {
    const pth = path.join(absPath, entry.name);
    if (entry.isDirectory()) return countFiles(pth, queue);
    return 1;
  });
  const results = await Promise.all(tasks);
  total = results.reduce((a, b) => a + b, 0);
  return total;
}

const WINDOWS_ONLY_ERROR = 'migrate-tool-dir is Windows-only in v0.9.x.';

export async function planToolDirMigration(args: {
  readonly tool?: MigrateToolId;
  readonly source?: string;
  readonly dest?: string;
  readonly destRoot?: string;
  readonly includeSize?: boolean;
}): Promise<MigrationPlan> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const winOnly = isWindows();

  let tool = args.tool;
  let source = args.source;
  let dest = args.dest;

  if (args.source) source = args.source;
  if (args.dest) dest = args.dest;

  if (tool && !source) {
    source = resolveToolDefaultSource(tool) ?? undefined;
    if (!source) errors.push(`Could not resolve default source path for tool: ${tool}`);
  }

  if (tool && !dest) {
    if (args.destRoot) {
      dest = path.join(args.destRoot, resolveToolDestLeaf(tool));
    } else {
      errors.push('Missing --dest-root (or pass --dest directly).');
    }
  }

  if (!source) errors.push('Missing --source (or pass --tool).');
  if (!dest) errors.push('Missing --dest (or pass --dest-root with --tool).');
  if (errors.length > 0) {
    return {
      ok: false,
      tool,
      source: source ?? '',
      dest: dest ?? '',
      destRoot: args.destRoot,
      warnings,
      errors,
    };
  }

  const sourceAbs = path.resolve(source!);
  const destAbs = path.resolve(dest!);

  if (isUnder(destAbs, sourceAbs)) {
    errors.push('Destination is inside source; refusing (would recurse).');
  }
  if (isUnder(sourceAbs, destAbs)) {
    errors.push('Source is inside destination; refusing.');
  }

  if (winOnly) {
    const blocked = isBlockedSource(sourceAbs);
    if (blocked) errors.push(blocked);

    if (!(await existsDir(sourceAbs))) {
      errors.push(`Source does not exist or is not a directory: ${sourceAbs}`);
    }

    if (await isSymlinkOrJunction(sourceAbs)) {
      errors.push(`Refusing to migrate a symlink/junction source without explicit override: ${sourceAbs}`);
    }

    const ntfsErr = destRequiresNtfs(destAbs);
    if (ntfsErr) errors.push(ntfsErr);

    if (tool && isToolMigrationPlanOnly(tool)) {
      warnings.push(`${tool} migration is plan-only in this release (see docs/product/tool-migration-profiles.md).`);
    }
  } else {
    errors.push(WINDOWS_ONLY_ERROR);
  }

  let bytes: number | undefined;
  let fileCount: number | undefined;
  if (winOnly && args.includeSize && errors.length === 0) {
    const queue = new TaskQueue(32);
    const sizeErrors: string[] = [];
    bytes = await getDirSizeBytes(sourceAbs, queue, sizeErrors);
    if (sizeErrors.length > 0) warnings.push(...sizeErrors.slice(0, 5));
    try {
      fileCount = await countFiles(sourceAbs, queue);
    } catch {
      warnings.push('File count estimate failed (permission or transient error).');
    }
  }

  return {
    ok: errors.length === 0,
    tool,
    source: sourceAbs,
    dest: destAbs,
    destRoot: args.destRoot,
    bytes,
    fileCount,
    warnings,
    errors,
    planOnly: tool ? isToolMigrationPlanOnly(tool) : false,
  };
}

async function writeAuditLog(payload: unknown): Promise<string | undefined> {
  try {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'deco-migrate-'));
    const file = path.join(dir, `migration-${nowStamp()}.json`);
    await writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
    return file;
  } catch {
    return undefined;
  }
}

export async function runToolDirMigration(plan: MigrationPlan, opts?: { readonly copyOnly?: boolean }): Promise<MigrationResult> {
  const warnings: string[] = [...plan.warnings];
  const errors: string[] = [];

  if (!plan.ok) {
    return { ok: false, source: plan.source, dest: plan.dest, warnings, errors: [...plan.errors] };
  }
  if (!isWindows()) {
    return { ok: false, source: plan.source, dest: plan.dest, warnings, errors: ['Windows-only in v0.9.0.'] };
  }
  if (plan.planOnly) {
    return {
      ok: false,
      source: plan.source,
      dest: plan.dest,
      warnings,
      errors: ['This tool target is plan-only in this release (use Plan for guidance).'],
    };
  }

  const sourceAbs = plan.source;
  const destAbs = plan.dest;

  const audit: Record<string, unknown> = {
    ts: new Date().toISOString(),
    source: sourceAbs,
    dest: destAbs,
    copyOnly: Boolean(opts?.copyOnly),
  };

  let backupPath: string | undefined;
  try {
    await mkdir(path.dirname(destAbs), { recursive: true });

    if (await existsDir(destAbs)) {
      const entries = await readdir(destAbs);
      if (entries.length > 0) {
        throw new Error(`Destination exists and is not empty: ${destAbs}`);
      }
    } else {
      await mkdir(destAbs, { recursive: true });
    }

    // Copy into destination.
    // Note: Node's fs.cp is generally reliable; junction creation is the critical part.
    const { cp } = await import('node:fs/promises');
    await cp(sourceAbs, destAbs, { recursive: true, force: false, errorOnExist: false });

    if (opts?.copyOnly) {
      warnings.push('Copy-only mode: original source was not replaced by a junction.');
      const auditLogPath = await writeAuditLog({ ...audit, result: 'copied' });
      return { ok: true, source: sourceAbs, dest: destAbs, warnings, errors, auditLogPath };
    }

    // Rename source out of the way, then create junction at original path.
    backupPath = `${sourceAbs}.deco-backup-${nowStamp()}`;
    await rename(sourceAbs, backupPath);
    await symlink(destAbs, sourceAbs, 'junction');

    // Verify junction resolves.
    const resolved = await realpath(sourceAbs);
    if (normalizeForPrefixCompare(resolved) !== normalizeForPrefixCompare(destAbs)) {
      throw new Error(`Junction verification failed: ${sourceAbs} -> ${resolved} (expected ${destAbs})`);
    }

    // Cleanup backup after successful verification.
    await rm(backupPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 });
    backupPath = undefined;

    const auditLogPath = await writeAuditLog({ ...audit, result: 'migrated', verified: true });
    return { ok: true, source: sourceAbs, dest: destAbs, warnings, errors, auditLogPath };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    errors.push(msg);

    // Best-effort rollback.
    try {
      if (await existsDir(sourceAbs)) {
        // If source exists, it might be a partially-created junction.
        const lst = await lstat(sourceAbs);
        if (lst.isSymbolicLink()) {
          await rm(sourceAbs, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 });
        }
      }
    } catch {
      warnings.push('Rollback warning: failed to remove partial junction at source.');
    }

    if (backupPath) {
      try {
        await rename(backupPath, sourceAbs);
      } catch {
        warnings.push(`Rollback warning: failed to restore backup folder: ${backupPath}`);
      }
    }

    const auditLogPath = await writeAuditLog({ ...audit, result: 'failed', errors, warnings });
    return { ok: false, source: sourceAbs, dest: destAbs, backupPath, warnings, errors, auditLogPath };
  }
}

