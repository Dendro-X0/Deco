import { access, stat } from 'node:fs/promises';
import path from 'node:path';
import { readAndValidateConfigFile } from './config.js';

export type PolicyValidateSuccess = {
  readonly ok: true;
  readonly configPath: string;
  readonly summary: string;
};

export type PolicyValidateFailure = {
  readonly ok: false;
  readonly inputPath: string;
  readonly error: string;
};

export type PolicyValidateResult = PolicyValidateSuccess | PolicyValidateFailure;

/** Resolve a policy JSON file or `.deco/` directory to `disk-cleanup.json`. */
export async function resolvePolicyConfigPath(input: string): Promise<string> {
  const abs = path.resolve(input);
  let st;
  try {
    st = await stat(abs);
  } catch {
    throw new Error(`Path not found: ${abs}`);
  }
  if (st.isFile()) {
    return abs;
  }
  if (!st.isDirectory()) {
    throw new Error(`Not a file or directory: ${abs}`);
  }
  const candidates = [
    path.join(abs, 'disk-cleanup.json'),
    path.join(abs, '.deco', 'disk-cleanup.json'),
  ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // try next layout
    }
  }
  throw new Error(
    `No disk-cleanup.json under ${abs} (expected disk-cleanup.json or .deco/disk-cleanup.json)`,
  );
}

function summarizePolicy(configPath: string, normalized: Awaited<ReturnType<typeof readAndValidateConfigFile>>): string {
  const parts = [
    `profile=${normalized.profile ?? 'default'}`,
    `roots=${normalized.roots.length}`,
    `excludes=${normalized.excludeAbsPathContains.length}`,
    `extraProtected=${normalized.safety.extraProtectedPathContains.length}`,
    `allowPaths=${normalized.safety.allowPathContains.length}`,
  ];
  return `${path.normalize(configPath)} (${parts.join(', ')})`;
}

export async function validatePolicyPath(input: string): Promise<PolicyValidateResult> {
  const inputPath = path.resolve(input);
  try {
    const configPath = await resolvePolicyConfigPath(input);
    const normalized = await readAndValidateConfigFile(configPath);
    return {
      ok: true,
      configPath,
      summary: summarizePolicy(configPath, normalized),
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, inputPath, error: message };
  }
}

export function getValidatePolicyUsageText(): string {
  return [
    'deco validate-policy — check a Deco policy pack before sharing',
    '',
    'Usage:',
    '  deco validate-policy <path>',
    '  deco validate-policy examples/deco-policies/monorepo-maintainer',
    '',
    '<path> may be:',
    '  - a disk-cleanup.json file',
    '  - a directory containing disk-cleanup.json',
    '  - a directory containing .deco/disk-cleanup.json',
    '',
    'Examples: see examples/deco-policies/ in the repo.',
    'Schema: apps/cli/config.schema.json',
    '',
    'Exit code 0 when valid; 1 on validation or path errors.',
  ].join('\n');
}
