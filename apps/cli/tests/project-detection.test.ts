import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { detectProjectRoot } from '../src/project-detection.js';

const tmpRoots: string[] = [];
const TMP_BASE = path.join(process.cwd(), '.tmp-tests');

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTmpRoot(prefix: string): Promise<string> {
  await mkdir(TMP_BASE, { recursive: true });
  return mkdtemp(path.join(TMP_BASE, prefix));
}

describe('project-detection', () => {
  it('detects a package project using package.json + lockfile', async () => {
    const root = await createTmpRoot('deco-project-');
    tmpRoots.push(root);

    await writeFile(path.join(root, 'package.json'), '{}', 'utf8');
    await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9', 'utf8');
    await mkdir(path.join(root, 'src'));

    const detected = await detectProjectRoot(path.join(root, 'src'));
    expect(detected?.projectRoot).toBe(root);
    expect(detected?.score).toBeGreaterThanOrEqual(90);
  });

  it('detects go projects from go.mod', async () => {
    const root = await createTmpRoot('deco-go-');
    tmpRoots.push(root);

    await writeFile(path.join(root, 'go.mod'), 'module example.com/test', 'utf8');
    await mkdir(path.join(root, 'cmd'));

    const detected = await detectProjectRoot(path.join(root, 'cmd'));
    expect(detected?.projectRoot).toBe(root);
    expect(detected?.reasons).toContain('go.mod');
  });

  it('returns null for folders with no project markers', async () => {
    const root = await createTmpRoot('deco-empty-');
    tmpRoots.push(root);

    await mkdir(path.join(root, 'folder'));

    const detected = await detectProjectRoot(path.join(root, 'folder'), 4, root);
    expect(detected).toBeNull();
  });
});
