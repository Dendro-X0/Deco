import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { purgeQuarantine, quarantineCandidate, restoreFromQuarantine } from '../src/quarantine.js';
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

function asCandidate(absPath: string): CleanupCandidate {
  return {
    kind: 'build-artifact',
    absPath,
    safetyClass: 'project_artifact',
    risk: 'safe',
    reasonCodes: ['PROJECT_MARKERS_PRESENT'],
  };
}

describe('quarantine workflow', () => {
  it('quarantines and restores a target directory', async () => {
    const root = await createTmpRoot('deco-quarantine-restore-');
    tmpRoots.push(root);

    const target = path.join(root, 'project', 'dist');
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'bundle.js'), 'hello', 'utf8');

    const quarantineRoot = path.join(root, '.deco-quarantine');
    const entry = await quarantineCandidate(asCandidate(target), quarantineRoot);

    expect(entry.id.length).toBeGreaterThan(0);

    const restoredPath = await restoreFromQuarantine(entry.id, [root], quarantineRoot);
    expect(restoredPath).toBe(target);

    const restoredContent = await readFile(path.join(target, 'bundle.js'), 'utf8');
    expect(restoredContent).toBe('hello');
  });

  it('purges expired quarantined items', async () => {
    const root = await createTmpRoot('deco-quarantine-purge-');
    tmpRoots.push(root);

    const target = path.join(root, 'project', 'build');
    await mkdir(target, { recursive: true });
    await writeFile(path.join(target, 'artifact.bin'), 'data', 'utf8');

    const quarantineRoot = path.join(root, '.deco-quarantine');
    const entry = await quarantineCandidate(asCandidate(target), quarantineRoot);

    const purge = await purgeQuarantine([root], 0, quarantineRoot);
    expect(purge.purged).toBeGreaterThanOrEqual(1);

    const restoreAttempt = restoreFromQuarantine(entry.id, [root], quarantineRoot);
    await expect(restoreAttempt).rejects.toThrow();
  });
});
