import { describe, expect, it } from 'vitest';
import {
  getToolMigrationProfile,
  isToolMigrationBundle,
  parseMigrateToolId,
  TOOL_MIGRATION_PROFILES,
  isToolMigrationPlanOnly,
  resolveToolBundleLegs,
} from '../src/tool-migration-profiles.js';

describe('tool-migration-profiles', () => {
  it('parses known profile ids', () => {
    for (const profile of TOOL_MIGRATION_PROFILES) {
      expect(parseMigrateToolId(profile.id)).toBe(profile.id);
    }
    expect(parseMigrateToolId('unknown-tool')).toBeNull();
  });

  it('cursor is a two-leg bundle profile', () => {
    expect(isToolMigrationBundle('cursor')).toBe(true);
    const profile = getToolMigrationProfile('cursor');
    expect(profile.bundleLegs).toHaveLength(2);
    expect(profile.bundleLegs?.[0]?.leg).toBe('roaming');
    expect(profile.bundleLegs?.[1]?.leg).toBe('local');
    expect(profile.bundleLegs?.[0]?.destLeaf).toBe('Cursor');
    expect(profile.bundleLegs?.[1]?.destLeaf).toBe('Cursor-Local');
  });

  it.skipIf(process.platform !== 'win32')('cursor bundle resolves Windows paths', () => {
    const { legs, errors } = resolveToolBundleLegs('cursor', 'G:\\DevToolData');
    expect(errors).toEqual([]);
    expect(legs).toHaveLength(2);
    expect(legs[0]?.leg).toBe('roaming');
    expect(legs[1]?.leg).toBe('local');
    expect(legs[0]?.dest).toMatch(/Cursor$/);
    expect(legs[1]?.dest).toMatch(/Cursor-Local$/);
  });

  it('marks package managers and docker as plan-only', () => {
    expect(isToolMigrationPlanOnly('docker-desktop')).toBe(true);
    expect(isToolMigrationPlanOnly('npm-cache')).toBe(true);
    expect(isToolMigrationPlanOnly('pnpm-store')).toBe(true);
    expect(isToolMigrationPlanOnly('claude-code')).toBe(false);
    expect(isToolMigrationPlanOnly('codex-cli')).toBe(false);
  });
});
