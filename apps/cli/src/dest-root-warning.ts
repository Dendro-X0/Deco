import path from 'node:path';
import {
  getToolMigrationProfile,
  isToolMigrationBundle,
  resolveToolDestLeaf,
  type MigrateToolId,
} from './tool-migration-profiles.js';

/** Warn when dest root already includes the tool leaf folder (matches desktop engine). */
export function destRootLeafWarning(destRoot: string, tool: MigrateToolId): string | undefined {
  const base = path.basename(path.resolve(destRoot));
  if (!base) return undefined;

  if (isToolMigrationBundle(tool)) {
    const profile = getToolMigrationProfile(tool);
    for (const spec of profile.bundleLegs ?? []) {
      const leaf = resolveToolDestLeaf(spec.sourceProfileId as MigrateToolId);
      if (base === leaf) {
        return `Destination root already ends with "${leaf}". Use the parent folder (e.g. G:\\DevToolData) — Deco appends ${leaf} automatically.`;
      }
    }
    return undefined;
  }

  const leaf = resolveToolDestLeaf(tool);
  if (base === leaf) {
    return `Destination root already ends with "${leaf}". Use the parent folder (e.g. G:\\DevToolData) — Deco will create …\\${leaf} under it.`;
  }
  return undefined;
}
