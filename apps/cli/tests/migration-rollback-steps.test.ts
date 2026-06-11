import { describe, expect, it } from 'vitest';
import { migrationRollbackSteps } from '../../frontend/src/lib/migration-rollback-steps';

describe('migration-rollback-steps', () => {
  it('returns guided steps with junction rmdir command', () => {
    const steps = migrationRollbackSteps({
      id: '1',
      tool: 'cursor',
      source_path: 'C:\\Users\\me\\AppData\\Roaming\\Cursor',
      dest_path: 'G:\\DevToolData\\Cursor',
      migrated_at: '2026-01-01T00:00:00.000Z',
      discovered: false,
    });
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.some((s) => s.command?.includes('rmdir "C:\\Users\\me\\AppData\\Roaming\\Cursor"'))).toBe(
      true,
    );
  });
});
