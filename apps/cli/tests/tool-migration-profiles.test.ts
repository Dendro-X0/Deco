import { describe, expect, it } from 'vitest';
import {
  parseMigrateToolId,
  TOOL_MIGRATION_PROFILES,
  isToolMigrationPlanOnly,
} from '../src/tool-migration-profiles.js';

describe('tool-migration-profiles', () => {
  it('parses known profile ids', () => {
    for (const profile of TOOL_MIGRATION_PROFILES) {
      expect(parseMigrateToolId(profile.id)).toBe(profile.id);
    }
    expect(parseMigrateToolId('unknown-tool')).toBeNull();
  });

  it('marks package managers and docker as plan-only', () => {
    expect(isToolMigrationPlanOnly('docker-desktop')).toBe(true);
    expect(isToolMigrationPlanOnly('npm-cache')).toBe(true);
    expect(isToolMigrationPlanOnly('pnpm-store')).toBe(true);
    expect(isToolMigrationPlanOnly('claude-code')).toBe(false);
    expect(isToolMigrationPlanOnly('codex-cli')).toBe(false);
  });
});
