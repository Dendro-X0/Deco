import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { classifyTargets } from '../src/classifier.js';
import { createPathPolicy } from '../src/path-policy.js';
import type { CliOptions } from '../src/types.js';
import type { DiscoveredTarget } from '../src/scan.js';

const tmpRoots: string[] = [];
const TMP_BASE = path.join(process.cwd(), '.tmp-tests');

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function baseOptions(root: string): CliOptions {
  return {
    action: 'scan',
    roots: [root],
    maxDepth: 6,
    mode: 'dry-run',
    yes: false,
    interactive: false,
    includeNodeModules: true,
    includeBuildArtifacts: true,
    includeRustArtifacts: true,
    includePlaywrightArtifacts: true,
    includeGoArtifacts: true,
    includeSize: false,
    checkGoCache: false,
    excludeAbsPathContains: [],
    profile: 'safe',
    deleteMode: 'quarantine',
    staleDays: 45,
    includeReview: false,
    json: false,
    showBlocked: true,
    purgeQuarantine: false,
    quarantineRetentionDays: 30,
    extraProtectedPathContains: [],
    allowPathContains: [],
    additionalDirNames: {
      buildArtifacts: [],
      rustArtifacts: [],
      goArtifacts: [],
      playwrightArtifacts: [],
    },
  };
}

async function createTmpRoot(prefix: string): Promise<string> {
  await mkdir(TMP_BASE, { recursive: true });
  return mkdtemp(path.join(TMP_BASE, prefix));
}

describe('classifier node_modules policy', () => {
  it('marks stale project node_modules as safe', async () => {
    const root = await createTmpRoot('deco-classify-safe-');
    tmpRoots.push(root);

    await writeFile(path.join(root, 'package.json'), '{}', 'utf8');
    await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9', 'utf8');
    const nodeModules = path.join(root, 'node_modules');
    await mkdir(nodeModules);

    const oldDate = new Date(Date.now() - 80 * 24 * 60 * 60 * 1000);
    await utimes(nodeModules, oldDate, oldDate);

    const discovered: DiscoveredTarget[] = [{ kind: 'node_modules', absPath: nodeModules, mtimeMs: oldDate.getTime() }];
    const options = baseOptions(root);
    const policy = createPathPolicy({ extraProtectedPathContains: [], allowPathContains: [] });

    const classified = await classifyTargets(discovered, options, policy);
    expect(classified[0].risk).toBe('safe');
    expect(classified[0].reasonCodes).toContain('NODE_MODULES_STALE');
  });

  it('marks fresh project node_modules as review', async () => {
    const root = await createTmpRoot('deco-classify-review-');
    tmpRoots.push(root);

    await writeFile(path.join(root, 'package.json'), '{}', 'utf8');
    await writeFile(path.join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9', 'utf8');
    const nodeModules = path.join(root, 'node_modules');
    await mkdir(nodeModules);

    const now = new Date();
    await utimes(nodeModules, now, now);

    const discovered: DiscoveredTarget[] = [{ kind: 'node_modules', absPath: nodeModules, mtimeMs: now.getTime() }];
    const options = baseOptions(root);
    const policy = createPathPolicy({ extraProtectedPathContains: [], allowPathContains: [] });

    const classified = await classifyTargets(discovered, options, policy);
    expect(classified[0].risk).toBe('review');
    expect(classified[0].reasonCodes).toContain('NODE_MODULES_NOT_STALE');
  });

  it('blocks node_modules outside detected projects', async () => {
    const root = await createTmpRoot('deco-classify-blocked-');
    tmpRoots.push(root);

    const nodeModules = path.join(root, 'node_modules');
    await mkdir(nodeModules);

    const discovered: DiscoveredTarget[] = [{ kind: 'node_modules', absPath: nodeModules, mtimeMs: Date.now() }];
    const options = baseOptions(root);
    const policy = createPathPolicy({ extraProtectedPathContains: [], allowPathContains: [] });

    const classified = await classifyTargets(discovered, options, policy);
    expect(classified[0].risk).toBe('blocked');
    expect(classified[0].reasonCodes).toContain('NODE_MODULES_OUTSIDE_PROJECT');
  });
});
