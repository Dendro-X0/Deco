import { rm } from 'node:fs/promises';
import { TaskQueue } from './concurrency.js';
import { quarantineCandidate, type QuarantineManifestEntry } from './quarantine.js';
import type { CleanupCandidate, DeleteMode } from './types.js';

const DELETE_CONCURRENCY = 32;

export type DeleteExecutionOptions = {
  readonly deleteMode: DeleteMode;
  readonly quarantineRoot?: string;
};

export type DeleteExecutionResult = {
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly quarantined: readonly QuarantineManifestEntry[];
};

export async function deleteCandidates(
  candidates: readonly CleanupCandidate[],
  options: DeleteExecutionOptions,
  onProgress?: (done: number) => void,
): Promise<DeleteExecutionResult> {
  const queue = new TaskQueue(DELETE_CONCURRENCY);
  const errors: string[] = [];
  const warnings: string[] = [];
  const quarantined: QuarantineManifestEntry[] = [];
  let done = 0;

  const effectiveMode: DeleteMode = options.deleteMode === 'recycle-bin' ? 'quarantine' : options.deleteMode;
  if (options.deleteMode === 'recycle-bin') {
    warnings.push('Recycle Bin mode is not available yet; falling back to quarantine mode.');
  }

  const tasks = candidates.map(async (candidate) => {
    try {
      if (candidate.risk === 'blocked') {
        errors.push(`Refused to delete blocked target: ${candidate.absPath}`);
        return;
      }

      if (effectiveMode === 'hard-delete') {
        await queue.run(() => rm(candidate.absPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 }));
      } else {
        const entry = await queue.run(() => quarantineCandidate(candidate, options.quarantineRoot));
        quarantined.push(entry);
      }
    } catch (error: unknown) {
      const code = (error as { code?: string }).code ?? 'unknown';
      errors.push(`Failed to delete ${candidate.absPath} (${code})`);
    } finally {
      done += 1;
      onProgress?.(done);
    }
  });

  await Promise.all(tasks);
  return { errors, warnings, quarantined };
}