import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { mergeConfigAndArgsV2 } from '../src/cli.js';

const tmpRoots: string[] = [];
const TMP_BASE = path.join(process.cwd(), '.tmp-tests');

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createTmpRoot(prefix: string): Promise<string> {
  await mkdir(TMP_BASE, { recursive: true });
  return mkdtemp(path.join(TMP_BASE, prefix));
}

describe('config merge precedence', () => {
  it('uses config defaults when CLI does not override', async () => {
    const root = await createTmpRoot('deco-merge-config-');
    tmpRoots.push(root);

    const configPath = path.join(root, 'disk-cleanup.json');
    await writeFile(configPath, JSON.stringify({
      roots: [path.join(root, 'config-root')],
      maxDepth: 8,
      profile: 'balanced',
      staleDays: 120,
      deleteMode: 'hard-delete',
      targets: {
        nodeModules: true,
        buildArtifacts: true,
        rustArtifacts: true,
        goArtifacts: false,
        playwrightArtifacts: true,
      },
    }), 'utf8');

    const merged = await mergeConfigAndArgsV2(['--config', configPath]);
    expect(merged.maxDepth).toBe(8);
    expect(merged.profile).toBe('balanced');
    expect(merged.staleDays).toBe(120);
    expect(merged.deleteMode).toBe('hard-delete');
    expect(merged.roots[0]).toContain('config-root');
  });

  it('applies CLI values over config values', async () => {
    const root = await createTmpRoot('deco-merge-cli-');
    tmpRoots.push(root);

    const configPath = path.join(root, 'disk-cleanup.json');
    await writeFile(configPath, JSON.stringify({
      roots: [path.join(root, 'config-root')],
      maxDepth: 8,
      profile: 'balanced',
      staleDays: 120,
      deleteMode: 'hard-delete',
      targets: {
        nodeModules: true,
        buildArtifacts: true,
        rustArtifacts: true,
        goArtifacts: false,
        playwrightArtifacts: true,
      },
    }), 'utf8');

    const cliRoot = path.join(root, 'cli-root');
    const merged = await mergeConfigAndArgsV2([
      '--config', configPath,
      '--root', cliRoot,
      '--max-depth', '3',
      '--profile', 'safe',
      '--stale-days', '30',
      '--delete-mode', 'quarantine',
      '--no-node-modules',
    ]);

    expect(merged.roots).toEqual([cliRoot]);
    expect(merged.maxDepth).toBe(3);
    expect(merged.profile).toBe('safe');
    expect(merged.staleDays).toBe(30);
    expect(merged.deleteMode).toBe('quarantine');
    expect(merged.includeNodeModules).toBe(false);
  });
});
