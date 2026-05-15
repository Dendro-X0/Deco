import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { hasGoModAncestor } from '../src/project-detection.js';

const tmpRoots: string[] = [];
const TMP_BASE = path.join(process.cwd(), '.tmp-tests');

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('hasGoModAncestor', () => {
  it('finds go.mod on a parent directory', async () => {
    await mkdir(TMP_BASE, { recursive: true });
    const root = await mkdtemp(path.join(TMP_BASE, 'deco-go-ancestor-'));
    tmpRoots.push(root);
    const goProj = path.join(root, 'goproj');
    await mkdir(path.join(goProj, 'cmd', 'app', 'bin'), { recursive: true });
    await writeFile(path.join(goProj, 'go.mod'), 'module example.com/x\n', 'utf8');
    await mkdir(path.join(root, 'nogo', 'bin'), { recursive: true });
    expect(await hasGoModAncestor(path.join(goProj, 'cmd', 'app', 'bin'), 6)).toBe(true);
    expect(await hasGoModAncestor(path.join(root, 'nogo', 'bin'), 6)).toBe(false);
  });
});
