import { mkdtemp, mkdir, rm, utimes, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReport } from '../src/cli.js';
import type { CliOptions } from '../src/types.js';

const tmpRoots: string[] = [];
const TMP_BASE = path.join(process.cwd(), '.tmp-tests');

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function createOptions(root: string): CliOptions {
  return {
    action: 'scan',
    roots: [root],
    maxDepth: 10,
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

describe('integration scan behavior', () => {
  it('finds stale project node_modules and avoids IDE runtime node_modules', async () => {
    const root = await createTmpRoot('deco-integration-');
    tmpRoots.push(root);

    const project = path.join(root, 'projects', 'app1');
    await mkdir(path.join(project, 'node_modules'), { recursive: true });
    await writeFile(path.join(project, 'package.json'), '{}', 'utf8');
    await writeFile(path.join(project, 'pnpm-lock.yaml'), 'lockfileVersion: 9', 'utf8');
    const staleDate = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);
    await utimes(path.join(project, 'node_modules'), staleDate, staleDate);

    const ideRuntimeModules = path.join(root, 'apps', 'Cursor', 'resources', 'app', 'node_modules');
    await mkdir(ideRuntimeModules, { recursive: true });

    const report = await buildReport(createOptions(root));

    const projectNodeModules = report.candidates.find((candidate) => candidate.absPath === path.join(project, 'node_modules'));
    expect(projectNodeModules?.risk).toBe('safe');

    const runtimeEntries = report.candidates.filter((candidate) => candidate.absPath.includes('resources') && candidate.absPath.includes('app'));
    expect(runtimeEntries.length).toBe(0);
  });
});
