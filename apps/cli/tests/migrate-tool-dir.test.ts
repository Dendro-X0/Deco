import { mkdtemp, mkdir, rm, writeFile, readlink } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { planToolDirMigration, runToolDirMigration } from '../src/migrate-tool-dir.js';

const tmpRoots: string[] = [];
const TMP_BASE = path.join(process.cwd(), '.tmp-tests');

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTmpRoot(prefix: string): Promise<string> {
  await mkdir(TMP_BASE, { recursive: true });
  return mkdtemp(path.join(TMP_BASE, prefix));
}

describe('migrate-tool-dir', () => {
  it('refuses dest inside source', async () => {
    const root = await createTmpRoot('deco-migrate-');
    tmpRoots.push(root);
    const source = path.join(root, 'Cursor');
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'a.txt'), 'hello', 'utf8');

    const plan = await planToolDirMigration({
      source,
      dest: path.join(source, 'nested'),
      includeSize: false,
    });
    expect(plan.ok).toBe(false);
    expect(plan.errors.join('\n')).toContain('Destination is inside source');
  });

  it('copy-only mode copies without junction', async () => {
    const root = await createTmpRoot('deco-migrate-copy-');
    tmpRoots.push(root);
    const source = path.join(root, 'Cursor');
    const dest = path.join(root, 'DestCursor');
    await mkdir(source, { recursive: true });
    await writeFile(path.join(source, 'a.txt'), 'hello', 'utf8');

    const plan = await planToolDirMigration({ source, dest, includeSize: false });
    expect(plan.ok, plan.errors.join('; ')).toBe(process.platform === 'win32');
    const result = await runToolDirMigration(plan, { copyOnly: true });
    expect(result.ok, result.errors.join('; ')).toBe(process.platform === 'win32');
  });

  it('run creates a junction (Windows only)', async () => {
    if (process.platform !== 'win32') return;
    const root = await createTmpRoot('deco-migrate-junction-');
    tmpRoots.push(root);

    const source = path.join(root, 'Cursor');
    const dest = path.join(root, 'DestCursor');
    await mkdir(source, { recursive: true });
    await mkdir(path.join(source, 'sub'), { recursive: true });
    await writeFile(path.join(source, 'sub', 'a.txt'), 'hello', 'utf8');

    const plan = await planToolDirMigration({ source, dest, includeSize: false });
    expect(plan.ok, plan.errors.join('; ')).toBe(true);

    const result = await runToolDirMigration(plan);
    expect(result.ok).toBe(true);

    // readlink() works for junctions/symlinks and should point at dest.
    const linkTarget = await readlink(source);
    expect(path.resolve(linkTarget).toLowerCase()).toBe(path.resolve(dest).toLowerCase());
  });
});

