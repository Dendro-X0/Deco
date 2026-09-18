import { mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { validateFirefoxProfileLayout } from '../src/firefox-profile-layout.js';

describe('firefox-profile-layout', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function makeFirefoxRoot(): Promise<string> {
    const root = path.join(os.tmpdir(), `deco-firefox-layout-${process.pid}-${Date.now()}`);
    tempDirs.push(root);
    await mkdir(path.join(root, 'Profiles', 'abc.default'), { recursive: true });
    await writeFile(
      path.join(root, 'profiles.ini'),
      '[Install4F96D1932A9F858E]\nDefault=Profiles/abc.default\n',
      'utf8',
    );
    return root;
  }

  it('errors when profiles.ini is missing', async () => {
    const root = path.join(os.tmpdir(), `deco-firefox-bad-${Date.now()}`);
    tempDirs.push(root);
    await mkdir(root, { recursive: true });
    const check = await validateFirefoxProfileLayout(root);
    expect(check.errors.some((e) => e.includes('profiles.ini'))).toBe(true);
  });

  it('accepts standard Mozilla Firefox layout', async () => {
    const root = await makeFirefoxRoot();
    const check = await validateFirefoxProfileLayout(root);
    expect(check.errors).toEqual([]);
    expect(check.warnings.some((w) => w.includes('profile folder'))).toBe(true);
  });
});
