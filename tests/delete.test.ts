import { access, mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { deleteCandidates } from '../src/delete.js';
import type { CleanupCandidate } from '../src/types.js';

const tmpRoots: string[] = [];
const TMP_BASE = path.join(process.cwd(), '.tmp-tests');

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTmpRoot(prefix: string): Promise<string> {
  await mkdir(TMP_BASE, { recursive: true });
  return mkdtemp(path.join(TMP_BASE, prefix));
}

async function exists(absPath: string): Promise<boolean> {
  try {
    await access(absPath);
    return true;
  } catch {
    return false;
  }
}

describe('delete execution', () => {
  it('refuses blocked targets', async () => {
    const root = await createTmpRoot('deco-delete-');
    tmpRoots.push(root);

    const safeDir = path.join(root, 'safe-dist');
    const blockedDir = path.join(root, 'blocked-runtime');
    await mkdir(safeDir, { recursive: true });
    await mkdir(blockedDir, { recursive: true });

    const candidates: CleanupCandidate[] = [
      {
        kind: 'build-artifact',
        absPath: safeDir,
        safetyClass: 'project_artifact',
        risk: 'safe',
        reasonCodes: ['PROJECT_MARKERS_PRESENT'],
      },
      {
        kind: 'node_modules',
        absPath: blockedDir,
        safetyClass: 'app_runtime',
        risk: 'blocked',
        reasonCodes: ['ELECTRON_RUNTIME_PATH'],
      },
    ];

    const result = await deleteCandidates(candidates, { deleteMode: 'hard-delete' });

    expect(result.errors.some((error) => error.includes('blocked target'))).toBe(true);
    expect(await exists(blockedDir)).toBe(true);
  });
});
