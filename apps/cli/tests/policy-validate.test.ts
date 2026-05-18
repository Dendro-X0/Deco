import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  resolvePolicyConfigPath,
  validatePolicyPath,
} from '../src/policy-validate.js';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const examplesRoot = path.join(repoRoot, 'examples', 'deco-policies');

describe('policy-validate', () => {
  it('resolves .deco layout under example pack', async () => {
    const configPath = await resolvePolicyConfigPath(
      path.join(examplesRoot, 'monorepo-maintainer'),
    );
    expect(configPath).toContain('disk-cleanup.json');
    expect(configPath).toContain('.deco');
  });

  it('validates all shipped example packs', async () => {
    for (const name of ['monorepo-maintainer', 'conservative-no-globals', 'ci-quick-scan']) {
      const result = await validatePolicyPath(path.join(examplesRoot, name));
      expect(result.ok, name).toBe(true);
    }
  });

  it('fails on unknown keys', async () => {
    const result = await validatePolicyPath(
      path.join(repoRoot, 'apps/cli/tests/fixtures/invalid-policy-pack'),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Unknown key');
    }
  });
});
