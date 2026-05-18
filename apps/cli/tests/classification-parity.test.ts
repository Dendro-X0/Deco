import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { classifyTargets } from '../src/classifier.js';
import { createPathPolicy } from '../src/path-policy.js';
import type { DiscoveredTarget } from '../src/scan.js';
import type { CliOptions } from '../src/types.js';
import {
  cleanupClassificationRoot,
  loadClassificationManifest,
  materializeClassificationCase,
} from './helpers/classification-fixtures.js';

const tmpRoots: string[] = [];
const TMP_BASE = path.join(process.cwd(), '.tmp-tests');

afterEach(async () => {
  await Promise.all(tmpRoots.splice(0).map((dir) => cleanupClassificationRoot(dir)));
});

function baseOptions(root: string, staleDays: number): CliOptions {
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
    includePythonArtifacts: true,
    includePythonVenv: false,
    includeJvmArtifacts: true,
    checkJvmGlobalCache: false,
    includeDotnetArtifacts: true,
    checkIdeGlobalCache: false,
    checkNpmCache: false,
    checkPnpmStore: false,
    checkYarnCache: false,
    checkPipCache: false,
    checkUvCache: false,
    checkCondaPkgsCache: false,
    checkBunCache: false,
    checkCargoRegistry: false,
    checkNugetCache: false,
    checkComposerCache: false,
    excludeAbsPathContains: [],
    profile: 'safe',
    deleteMode: 'quarantine',
    staleDays,
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

describe('classification parity (shared fixtures)', () => {
  it('matches tests/fixtures/classification/cases.json', async () => {
    const manifest = await loadClassificationManifest();
    expect(manifest.version).toBe(1);

    const policy = createPathPolicy({ extraProtectedPathContains: [], allowPathContains: [] });

    for (const caseDef of manifest.cases) {
      const { root, mtimeByRel } = await materializeClassificationCase(caseDef, TMP_BASE);
      tmpRoots.push(root);

      const discovered: DiscoveredTarget[] = caseDef.targets.map((t) => ({
        kind: t.kind,
        absPath: path.join(root, t.rel_path),
        mtimeMs: mtimeByRel.get(t.rel_path),
      }));

      const classified = await classifyTargets(
        discovered,
        baseOptions(root, manifest.stale_days),
        policy,
      );

      expect(classified, caseDef.id).toHaveLength(caseDef.expect.length);

      for (let i = 0; i < caseDef.expect.length; i++) {
        const exp = caseDef.expect[i]!;
        const got = classified[i]!;
        expect(got.risk, `${caseDef.id}[${i}].risk`).toBe(exp.risk);
        expect(got.safetyClass, `${caseDef.id}[${i}].safety_class`).toBe(exp.safety_class);
        for (const code of exp.reason_codes) {
          expect(got.reasonCodes, `${caseDef.id}[${i}].reason_codes`).toContain(code);
        }
      }
    }
  });
});
