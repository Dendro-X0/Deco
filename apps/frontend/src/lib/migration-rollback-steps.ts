import type { ManagedMigrationEntry } from './tool-migration-types';

export type MigrationRollbackStep = {
  id: string;
  command?: string;
};

/** Guided rollback for a listed-profile junction migration (not one-click). */
export function migrationRollbackSteps(entry: ManagedMigrationEntry): MigrationRollbackStep[] {
  const source = entry.source_path;
  const dest = entry.dest_path;

  return [
    { id: 'quit' },
    { id: 'removeJunction', command: `rmdir "${source}"` },
    { id: 'restoreBackup' },
    { id: 'verify', command: `dir "${source}"` },
    { id: 'optionalCleanup', command: `dir "${dest}"` },
    { id: 'dismissRegistry' },
  ];
}
