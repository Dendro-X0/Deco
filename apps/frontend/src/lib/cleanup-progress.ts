import type { ScanProgress } from './scan-progress';

export type CleanupStage =
  | 'prepare'
  | 'remove_tree'
  | 'remove_tree_start'
  | 'fast_remove_tree'
  | 'fast_remove_tree_start'
  | 'parallel_pulse'
  | 'move'
  | 'record'
  | 'skip'
  | 'done';

function progressDone(payload: CleanupProgressPayload): number {
  return payload.completed_count ?? payload.index;
}

export type CleanupProgressPayload = {
  index: number;
  total: number;
  abs_path: string;
  action: string;
  stage?: string;
  kind?: string;
  message?: string;
  detail?: string;
  completed_count?: number;
  in_flight_count?: number;
};

function fileNameFromPath(absPath: string): string {
  const parts = absPath.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? absPath;
}

function isNodeModulesPath(absPath: string, kind?: string): boolean {
  const k = (kind ?? '').toLowerCase();
  if (k === 'node_modules' || k.includes('node')) return true;
  const norm = absPath.replace(/\\/g, '/').toLowerCase();
  return norm.includes('/node_modules') || norm.endsWith('node_modules');
}

/** User-facing headline + subline for cleanup overlay and status bar. */
export function formatCleanupProgress(payload: CleanupProgressPayload): {
  text: string;
  detail: string;
} {
  if (payload.message && payload.detail) {
    return { text: payload.message, detail: payload.detail };
  }

  const name = fileNameFromPath(payload.abs_path);
  const total = payload.total;
  const action = payload.action;
  const stage = (payload.stage ?? 'prepare') as CleanupStage;
  const heavy = isNodeModulesPath(payload.abs_path, payload.kind);

  const done = progressDone(payload);
  const inFlight = payload.in_flight_count ?? 0;
  const prefix = total > 1 ? `${done}/${total}: ` : '';

  if (stage === 'parallel_pulse') {
    if (inFlight <= 1) {
      return {
        text: `${prefix}Removing folders one at a time…`,
        detail:
          payload.detail ||
          'HDD / sequential mode — one tree finishes before the next starts. Pause anytime between folders.',
      };
    }
    return {
      text: `${prefix}${inFlight} folder(s) removing in parallel…`,
      detail:
        payload.detail ||
        'Large trees can take several minutes each on a slow disk — the counter updates when each finishes.',
    };
  }

  if (stage === 'fast_remove_tree_start' || stage === 'remove_tree_start') {
    return {
      text: `${prefix}Started ${name}…`,
      detail:
        inFlight > 1
          ? `${inFlight} deletes in flight. ${payload.detail || ''}`.trim()
          : inFlight === 1 && total > 1
            ? payload.detail || 'Sequential delete — one folder at a time (HDD mode).'
            : payload.detail || 'Bulk system delete (rmdir / rm -rf).',
    };
  }

  if (stage === 'fast_remove_tree') {
    return {
      text: `${prefix}Finished ${name} (fast)`,
      detail:
        inFlight > 1
          ? `${inFlight} still removing in parallel.`
          : inFlight === 1 && total > 1
            ? 'Next folder starts when this one finishes (sequential / HDD mode).'
            : total > 1
              ? 'Bulk system delete — parallelism follows Cleanup disk mode and Scan behavior → Performance.'
              : 'Using the system bulk-remove command (like rmdir /s /q or rm -rf) instead of walking every file in Rust.',
    };
  }

  if (stage === 'remove_tree' || (stage === 'prepare' && action === 'delete' && heavy)) {
    return {
      text: `${prefix}Removing ${name}…`,
      detail: heavy
        ? 'node_modules has thousands of small files — Windows must walk the tree before delete finishes. This can take several minutes even when the folder size looks small.'
        : 'Walking the directory tree and deleting files. Large build folders take longer than their size suggests.',
    };
  }

  if (action === 'delete') {
    if (stage === 'prepare') {
      return {
        text: `${prefix}Preparing to delete ${name}…`,
        detail: heavy
          ? 'About to remove a dependency folder (many nested files).'
          : 'Verifying path and starting removal.',
      };
    }
    return {
      text: `${prefix}Deleting ${name}…`,
      detail: 'Removing files from disk (not recoverable from Quarantine).',
    };
  }

  if (stage === 'move') {
    return {
      text: `${prefix}Moving ${name} to quarantine…`,
      detail: heavy
        ? 'Same-drive rename when possible; otherwise copying many files first.'
        : 'Renaming on the same drive when possible (fast).',
    };
  }

  if (stage === 'record') {
    return {
      text: `${prefix}Recording quarantine entry…`,
      detail: 'Updating the local restore index.',
    };
  }

  return {
    text: payload.message || `${prefix}Cleaning up ${name}…`,
    detail: payload.detail || 'Working in the background — the window stays responsive.',
  };
}

export function cleanupProgressToScanProgress(
  payload: CleanupProgressPayload,
  percent: number,
): ScanProgress {
  const { text, detail } = formatCleanupProgress(payload);
  return { percent, text, phase: 'cleanup', detail };
}
