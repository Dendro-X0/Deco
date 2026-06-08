import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCAN_REPORT_SCHEMA_VERSION, targetKindToWire } from '../src/scan-contract.js';
import type { TargetDirKind } from '../src/types.js';

type ScanReportSchema = {
  properties: {
    schema_version: { pattern: string };
    inventory_reused?: unknown;
    discover_ms?: unknown;
    classify_ms?: unknown;
    size_ms?: unknown;
  };
  $defs: {
    candidate: {
      properties: {
        kind: { enum: string[] };
        risk: { enum: string[] };
        safety_class: { enum: string[] };
      };
    };
  };
};

const CLI_KINDS: TargetDirKind[] = [
  'node_modules',
  'build-artifact',
  'rust-artifact',
  'go-artifact',
  'go-global-cache',
  'playwright-artifact',
  'unknown-artifact',
  'python-artifact',
  'python-venv',
  'jvm-artifact',
  'jvm-global-cache',
  'dotnet-artifact',
  'ide-global-cache',
  'npm-global-cache',
  'pnpm-global-store',
  'yarn-global-cache',
  'pip-global-cache',
  'uv-global-cache',
  'conda-pkgs-cache',
  'cargo-registry-cache',
  'bun-global-cache',
  'nuget-global-cache',
  'composer-global-cache',
  'vcpkg-installed-cache',
  'conan-global-cache',
  'ccache-global-cache',
  'sccache-global-cache',
  'bazel-disk-cache',
];

async function loadSchema(): Promise<ScanReportSchema> {
  const schemaPath = path.join(process.cwd(), '..', '..', 'docs', 'schemas', 'scan-report.schema.json');
  const raw = await readFile(schemaPath, 'utf8');
  return JSON.parse(raw) as ScanReportSchema;
}

describe('scan-report.schema.json parity', () => {
  it('schema_version pattern accepts current contract version', async () => {
    const schema = await loadSchema();
    const pattern = new RegExp(schema.properties.schema_version.pattern);
    expect(pattern.test(SCAN_REPORT_SCHEMA_VERSION)).toBe(true);
  });

  it('kind enum matches CLI targetKindToWire mapping', async () => {
    const schema = await loadSchema();
    const enumKinds = new Set(schema.$defs.candidate.properties.kind.enum);
    const wireKinds = CLI_KINDS.map((k) => targetKindToWire(k));
    expect(wireKinds.length).toBe(enumKinds.size);
    for (const wire of wireKinds) {
      expect(enumKinds.has(wire), `schema missing kind ${wire}`).toBe(true);
    }
  });

  it('risk and safety_class enums match wire tiers', async () => {
    const schema = await loadSchema();
    expect(schema.$defs.candidate.properties.risk.enum).toEqual(['safe', 'review', 'blocked']);
    expect(schema.$defs.candidate.properties.safety_class.enum).toEqual([
      'project_artifact',
      'global_cache',
      'app_runtime',
      'system',
      'unknown',
    ]);
  });

  it('documents desktop timing and inventory fields', async () => {
    const schema = await loadSchema();
    expect(schema.properties).toHaveProperty('inventory_reused');
    expect(schema.properties).toHaveProperty('discover_ms');
    expect(schema.properties).toHaveProperty('classify_ms');
    expect(schema.properties).toHaveProperty('size_ms');
  });
});
