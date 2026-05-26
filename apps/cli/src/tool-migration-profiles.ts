import path from 'node:path';

/** Canonical migration profiles — keep in sync with docs/product/tool-migration-profiles.md and Rust `ToolId`. */
export type ToolMigrationCategory = 'agent' | 'ide' | 'container' | 'package-manager';

export type ToolMigrationProfile = {
  readonly id: string;
  readonly label: string;
  readonly category: ToolMigrationCategory;
  readonly destLeaf: string;
  readonly planOnly: boolean;
  readonly docNote?: string;
};

export const TOOL_MIGRATION_PROFILES: readonly ToolMigrationProfile[] = [
  {
    id: 'cursor',
    label: 'Cursor (Roaming)',
    category: 'agent',
    destLeaf: 'Cursor',
    planOnly: false,
    docNote: 'Migrates %APPDATA%\\Cursor only; use cursor-local for LocalAppData caches.',
  },
  {
    id: 'cursor-local',
    label: 'Cursor (Local cache)',
    category: 'agent',
    destLeaf: 'Cursor-Local',
    planOnly: false,
  },
  {
    id: 'vscode',
    label: 'VS Code',
    category: 'ide',
    destLeaf: 'Code',
    planOnly: false,
  },
  {
    id: 'claude-code',
    label: 'Claude Code',
    category: 'agent',
    destLeaf: 'claude-code',
    planOnly: false,
    docNote: 'Migrates %USERPROFILE%\\.claude; .claude.json at profile root is not moved in v0.9.1.',
  },
  {
    id: 'codex-cli',
    label: 'OpenAI Codex CLI',
    category: 'agent',
    destLeaf: 'codex',
    planOnly: false,
    docNote: 'Uses CODEX_HOME when set, else %USERPROFILE%\\.codex.',
  },
  {
    id: 'claude-desktop',
    label: 'Claude Desktop (GUI)',
    category: 'agent',
    destLeaf: 'Claude-Desktop',
    planOnly: true,
    docNote: 'MSIX installs may virtualize AppData; verify path before run.',
  },
  {
    id: 'docker-desktop',
    label: 'Docker Desktop',
    category: 'container',
    destLeaf: 'Docker',
    planOnly: true,
  },
  {
    id: 'npm-cache',
    label: 'npm cache',
    category: 'package-manager',
    destLeaf: 'npm-cache',
    planOnly: true,
    docNote: 'Regenerable cache; quit npm/node processes before run.',
  },
  {
    id: 'pnpm-store',
    label: 'pnpm store',
    category: 'package-manager',
    destLeaf: 'pnpm-store',
    planOnly: true,
    docNote: 'Default store path; custom store-dir may need --source/--dest.',
  },
] as const;

export type MigrateToolId = (typeof TOOL_MIGRATION_PROFILES)[number]['id'];

const PROFILE_BY_ID = new Map(TOOL_MIGRATION_PROFILES.map((p) => [p.id, p]));

export function parseMigrateToolId(raw: string): MigrateToolId | null {
  const id = raw.trim().toLowerCase();
  return PROFILE_BY_ID.has(id) ? (id as MigrateToolId) : null;
}

export function getToolMigrationProfile(id: MigrateToolId): ToolMigrationProfile {
  const profile = PROFILE_BY_ID.get(id);
  if (!profile) throw new Error(`unknown tool profile: ${id}`);
  return profile;
}

export function isToolMigrationPlanOnly(id: MigrateToolId): boolean {
  return getToolMigrationProfile(id).planOnly;
}

function userProfileDir(): string | null {
  return process.env.USERPROFILE ?? process.env.HOME ?? null;
}

/** Primary default source path for a profile on Windows. */
export function resolveToolDefaultSource(id: MigrateToolId): string | null {
  if (process.platform !== 'win32') return null;

  const appData = process.env.APPDATA;
  const localAppData = process.env.LOCALAPPDATA;
  const profile = userProfileDir();

  switch (id) {
    case 'cursor':
      return appData ? path.join(appData, 'Cursor') : null;
    case 'cursor-local':
      return localAppData ? path.join(localAppData, 'Cursor') : null;
    case 'vscode':
      return appData ? path.join(appData, 'Code') : null;
    case 'claude-code':
      return profile ? path.join(profile, '.claude') : null;
    case 'codex-cli': {
      const codexHome = process.env.CODEX_HOME?.trim();
      if (codexHome) return codexHome;
      return profile ? path.join(profile, '.codex') : null;
    }
    case 'claude-desktop':
      return appData ? path.join(appData, 'Claude') : null;
    case 'docker-desktop':
      return localAppData ? path.join(localAppData, 'Docker') : null;
    case 'npm-cache': {
      if (localAppData) return path.join(localAppData, 'npm-cache');
      if (appData) return path.join(appData, 'npm-cache');
      return profile ? path.join(profile, 'AppData', 'Local', 'npm-cache') : null;
    }
    case 'pnpm-store': {
      if (localAppData) return path.join(localAppData, 'pnpm', 'store');
      return profile ? path.join(profile, 'AppData', 'Local', 'pnpm', 'store') : null;
    }
    default:
      return null;
  }
}

export function resolveToolDestLeaf(id: MigrateToolId): string {
  return getToolMigrationProfile(id).destLeaf;
}
