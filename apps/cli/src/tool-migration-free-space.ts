import { execSync } from 'node:child_process';
import path from 'node:path';

const DEST_FREE_SPACE_NUM = 12n;
const DEST_FREE_SPACE_DEN = 10n;
const SOURCE_LOW_ABS_BYTES = 2 * 1024 * 1024 * 1024;
const SOURCE_LOW_PCT = 5;

export function formatBytesHint(bytes: number): string {
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  if (bytes >= gb) return `${(bytes / gb).toFixed(1)} GB`;
  if (bytes >= mb) return `${Math.round(bytes / mb)} MB`;
  return `${bytes} bytes`;
}

export function requiredDestFreeBytes(sourceBytes: number): number {
  if (sourceBytes <= 0) return 0;
  return Number((BigInt(sourceBytes) * DEST_FREE_SPACE_NUM) / DEST_FREE_SPACE_DEN);
}

export function destInsufficientFreeSpaceError(
  sourceBytes: number,
  availableBytes: number,
  mount: string,
): string | null {
  if (sourceBytes <= 0) return null;
  const required = requiredDestFreeBytes(sourceBytes);
  if (availableBytes >= required) return null;
  return `Destination volume ${mount} has insufficient free space (need at least ${formatBytesHint(required)} for a 1.2× safety margin; ${formatBytesHint(availableBytes)} available).`;
}

export function sourceLowFreeSpaceWarning(
  availableBytes: number,
  totalBytes: number,
  mount: string,
): string | null {
  if (totalBytes <= 0) return null;
  const pct = (availableBytes / totalBytes) * 100;
  if (availableBytes >= SOURCE_LOW_ABS_BYTES && pct >= SOURCE_LOW_PCT) return null;
  return `Source volume ${mount} is low on free space (${formatBytesHint(availableBytes)} available). Migration may fail during rename/junction; free several GB on the OS drive before Run.`;
}

export type VolumeFreeSpace = {
  readonly mount: string;
  readonly availableBytes: number;
  readonly totalBytes: number;
};

/** Drive letter mount (e.g. `G:\\`) for an absolute Windows path. */
export function driveMountForPath(absPath: string): string | null {
  const m = /^([A-Za-z]):/.exec(path.resolve(absPath));
  if (!m) return null;
  return `${m[1]!.toUpperCase()}:\\`;
}

export function readWindowsVolumeFreeSpace(driveLetter: string): VolumeFreeSpace | null {
  const letter = driveLetter.replace(/:\\?$/, '').toUpperCase();
  if (!/^[A-Z]$/.test(letter)) return null;
  try {
    const out = execSync(
      `powershell -NoProfile -Command "$v=Get-Volume -DriveLetter ${letter} -ErrorAction Stop; Write-Output $v.SizeRemaining; Write-Output $v.Size"`,
      { encoding: 'utf8', timeout: 15_000 },
    );
    const lines = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const available = Number(lines[0]);
    const total = Number(lines[1]);
    if (!Number.isFinite(available) || !Number.isFinite(total) || total <= 0) return null;
    return { mount: `${letter}:\\`, availableBytes: available, totalBytes: total };
  } catch {
    // fall through
  }
  try {
    const out = execSync(
      `wmic logicaldisk where "DeviceID='${letter}:'" get FreeSpace,Size /format:csv`,
      { encoding: 'utf8', timeout: 15_000 },
    );
    const rows = out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l && !/^Node,/i.test(l));
    for (const row of rows) {
      const parts = row.split(',');
      // Node,DeviceID,FreeSpace,Size or Node,FreeSpace,Size
      const nums = parts.map((p) => Number(p)).filter((n) => Number.isFinite(n) && n > 0);
      if (nums.length >= 2) {
        const available = nums[nums.length - 2]!;
        const total = nums[nums.length - 1]!;
        return { mount: `${letter}:\\`, availableBytes: available, totalBytes: total };
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function applyFreeSpaceChecks(args: {
  readonly source: string;
  readonly dest: string;
  readonly bytes?: number;
  readonly alreadyComplete?: boolean;
}): { readonly errors: string[]; readonly warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (args.alreadyComplete) return { errors, warnings };

  const needed = args.bytes ?? 0;
  if (needed > 0) {
    const destMount = driveMountForPath(args.dest);
    const destVol = destMount ? readWindowsVolumeFreeSpace(destMount) : null;
    if (destVol) {
      const err = destInsufficientFreeSpaceError(needed, destVol.availableBytes, destVol.mount);
      if (err) errors.push(err);
    } else {
      warnings.push(
        'Could not read destination volume free space; verify enough free space before Run.',
      );
    }
  }

  const sourceMount = driveMountForPath(args.source);
  const sourceVol = sourceMount ? readWindowsVolumeFreeSpace(sourceMount) : null;
  if (sourceVol) {
    const w = sourceLowFreeSpaceWarning(
      sourceVol.availableBytes,
      sourceVol.totalBytes,
      sourceVol.mount,
    );
    if (w) warnings.push(w);
  }

  return { errors, warnings };
}
