import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { planToolDirMigration } from '../src/migrate-tool-dir.js';

const tmpRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('migrate-tool-dir custom paths', () => {
  it.skipIf(process.platform !== 'win32')('marks --source/--dest as custom copy-assist', async () => {
    const root = await mkdtemp(path.join(process.cwd(), '.tmp-tests', 'deco-custom-'));
    tmpRoots.push(root);
    const source = path.join(root, 'Game');
    const dest = path.join(root, 'DestGame');
    await mkdir(source, { recursive: true });

    const plan = await planToolDirMigration({ source, dest, includeSize: false });
    expect(plan.customMode).toBe(true);
    expect(plan.warnings.some((w) => w.includes('COPY ASSIST'))).toBe(true);
  });
});
