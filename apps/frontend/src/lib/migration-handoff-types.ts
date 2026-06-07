import type { ToolMigrationUiId } from '@/lib/tool-migration-profiles';

export type MigrationHandoffCandidate = {
  tool: string;
  source_path: string;
  bytes?: number;
  already_migrated: boolean;
};

export type MigrationHandoffStatus = {
  supported: boolean;
  low_space: boolean;
  system_mount?: string;
  available_bytes?: number;
  total_bytes?: number;
  free_pct?: number;
  candidates: MigrationHandoffCandidate[];
  suggested_tool?: string;
};

export function isToolMigrationUiId(id: string): id is ToolMigrationUiId {
  return id !== 'custom';
}

const DISMISS_KEY = 'deco-migration-handoff-dismiss';

export function readHandoffDismissSnapshot(): string | null {
  try {
    return sessionStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

export function writeHandoffDismissSnapshot(availableBytes: number | undefined): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, String(availableBytes ?? 0));
  } catch {
    /* ignore */
  }
}

/** Dismiss until free space changes by at least 1 GiB from snapshot. */
export function isHandoffDismissed(availableBytes: number | undefined): boolean {
  const raw = readHandoffDismissSnapshot();
  if (raw == null) return false;
  const prev = Number(raw);
  if (!Number.isFinite(prev) || availableBytes == null) return true;
  const delta = Math.abs(availableBytes - prev);
  return delta < 1024 * 1024 * 1024;
}
