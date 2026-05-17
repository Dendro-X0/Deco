import type { ScanProgress } from './scan-progress';

export type CleanupStage =
  | 'prepare'
  | 'remove_tree'
  | 'move'
  | 'record'
  | 'skip'
  | 'done';

export type CleanupProgressPayload = {
  index: number;
  total: number;
  abs_path: string;
  action: string;
  stage?: string;
  kind?: string;
  message?: string;
  detail?: string;
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
  const index = payload.index;
  const total = payload.total;
  const action = payload.action;
  const stage = (payload.stage ?? 'prepare') as CleanupStage;
  const heavy = isNodeModulesPath(payload.abs_path, payload.kind);

  const prefix = total > 1 ? `Item ${index}/${total}: ` : '';

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
