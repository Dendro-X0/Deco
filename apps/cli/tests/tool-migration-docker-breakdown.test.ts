import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeDockerDisk,
  dockerBreakdownWarnings,
  dockerVhdxCandidates,
  findDockerVhdx,
} from '../src/tool-migration-docker-breakdown.js';

describe('tool-migration-docker-breakdown', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeDockerFixture(): Promise<{ root: string; vhdxPath: string }> {
    const root = path.join(
      os.tmpdir(),
      `deco-docker-${process.pid}-${tempDirs.length}-${Date.now()}`,
    );
    tempDirs.push(root);
    const dockerRoot = path.join(root, 'Docker');
    const vhdxPath = path.join(dockerRoot, 'wsl', 'data', 'ext4.vhdx');
    await mkdir(path.dirname(vhdxPath), { recursive: true });
    await writeFile(vhdxPath, Buffer.alloc(2048));
    await writeFile(path.join(dockerRoot, 'settings.json'), '{"ok":true}');
    return { root: dockerRoot, vhdxPath };
  }

  it('lists known vhdx candidate paths', () => {
    const candidates = dockerVhdxCandidates('C:\\Users\\me\\AppData\\Local\\Docker');
    expect(candidates.some((p) => p.endsWith(`${path.sep}wsl${path.sep}data${path.sep}ext4.vhdx`))).toBe(
      true,
    );
  });

  it.skipIf(process.platform !== 'win32')('analyzes vhdx vs metadata bytes', async () => {
    const { root, vhdxPath } = await makeDockerFixture();
    const found = await findDockerVhdx(root);
    expect(found).toBe(vhdxPath);

    const breakdown = await analyzeDockerDisk(root, 4096);
    expect(breakdown.vhdxBytes).toBe(2048);
    expect(breakdown.appdataExcludingVhdxBytes).toBe(2048);

    const warnings = dockerBreakdownWarnings(breakdown);
    expect(warnings.some((w) => w.includes('plan-only'))).toBe(true);
    expect(warnings.some((w) => w.includes('ext4.vhdx'))).toBe(true);
  });
});
