import path from 'node:path';

/** Canonical migration profiles — keep in sync with docs/product/tool-migration-profiles.md and Rust `ToolId`. */
export type ToolMigrationCategory =
  | 'agent'
  | 'ide'
  | 'browser'
  | 'utility'
  | 'game'
  | 'container'
  | 'package-manager';

export type ToolMigrationBundleLeg = {
  readonly leg: string;
  readonly sourceProfileId: string;
  readonly destLeaf: string;
};

export type ToolMigrationProfile = {
  readonly id: string;
  readonly label: string;
  readonly category: ToolMigrationCategory;
  readonly destLeaf: string;
  readonly planOnly: boolean;
  readonly hideFromUi?: boolean;
  readonly bundleLegs?: readonly ToolMigrationBundleLeg[];
  readonly docNote?: string;
};

export const TOOL_MIGRATION_PROFILES: readonly ToolMigrationProfile[] = [
  // --- Agents & IDEs ---
  {
    id: 'cursor',
    label: 'Cursor (Roaming + Local)',
    category: 'agent',
    destLeaf: 'Cursor',
    planOnly: false,
    docNote: 'Migrates %APPDATA%\\Cursor and %LOCALAPPDATA%\\Cursor in one run.',
    bundleLegs: [
      { leg: 'roaming', sourceProfileId: 'cursor-roaming', destLeaf: 'Cursor' },
      { leg: 'local', sourceProfileId: 'cursor-local', destLeaf: 'Cursor-Local' },
    ],
  },
  {
    id: 'cursor-roaming',
    label: 'Cursor (Roaming only)',
    category: 'agent',
    destLeaf: 'Cursor',
    planOnly: false,
    hideFromUi: true,
  },
  {
    id: 'cursor-local',
    label: 'Cursor (Local cache only)',
    category: 'agent',
    destLeaf: 'Cursor-Local',
    planOnly: false,
    hideFromUi: true,
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
  // --- Browsers (AppData) ---
  {
    id: 'google-chrome',
    label: 'Google Chrome (User Data)',
    category: 'browser',
    destLeaf: 'Google-Chrome',
    planOnly: false,
    docNote: 'Quit Chrome completely (Task Manager + tray). Profile path under LocalAppData.',
  },
  {
    id: 'microsoft-edge',
    label: 'Microsoft Edge (User Data)',
    category: 'browser',
    destLeaf: 'Microsoft-Edge',
    planOnly: false,
    docNote: 'Quit Edge completely before Run.',
  },
  {
    id: 'brave',
    label: 'Brave (User Data)',
    category: 'browser',
    destLeaf: 'Brave-Browser',
    planOnly: false,
    docNote: 'Quit Brave completely before Run.',
  },
  {
    id: 'firefox',
    label: 'Mozilla Firefox',
    category: 'browser',
    destLeaf: 'Firefox',
    planOnly: true,
    docNote: 'Profiles live under Roaming\\Mozilla\\Firefox; verify layout before run.',
  },
  // --- Utilities (AppData) ---
  {
    id: 'discord',
    label: 'Discord (Roaming + Local)',
    category: 'utility',
    destLeaf: 'Discord',
    planOnly: false,
    docNote: 'Roaming\\discord + Local\\Discord. Quit Discord from tray first.',
    bundleLegs: [
      { leg: 'roaming', sourceProfileId: 'discord-roaming', destLeaf: 'Discord' },
      { leg: 'local', sourceProfileId: 'discord-local', destLeaf: 'Discord-Local' },
    ],
  },
  {
    id: 'discord-roaming',
    label: 'Discord (Roaming only)',
    category: 'utility',
    destLeaf: 'Discord',
    planOnly: false,
    hideFromUi: true,
  },
  {
    id: 'discord-local',
    label: 'Discord (Local only)',
    category: 'utility',
    destLeaf: 'Discord-Local',
    planOnly: false,
    hideFromUi: true,
  },
  {
    id: 'spotify',
    label: 'Spotify',
    category: 'utility',
    destLeaf: 'Spotify',
    planOnly: false,
    docNote: '%APPDATA%\\Spotify — quit Spotify before Run.',
  },
  {
    id: 'slack',
    label: 'Slack',
    category: 'utility',
    destLeaf: 'Slack',
    planOnly: false,
    docNote: '%APPDATA%\\Slack',
  },
  {
    id: 'telegram',
    label: 'Telegram Desktop',
    category: 'utility',
    destLeaf: 'Telegram',
    planOnly: false,
    docNote: '%APPDATA%\\Telegram Desktop',
  },
  {
    id: 'notion',
    label: 'Notion',
    category: 'utility',
    destLeaf: 'Notion',
    planOnly: false,
    docNote: '%APPDATA%\\Notion',
  },
  {
    id: 'obs-studio',
    label: 'OBS Studio',
    category: 'utility',
    destLeaf: 'OBS-Studio',
    planOnly: false,
    docNote: '%APPDATA%\\obs-studio — scenes and settings.',
  },
  // --- Games (AppData) ---
  {
    id: 'epic-games',
    label: 'Epic Games Launcher',
    category: 'game',
    destLeaf: 'EpicGamesLauncher',
    planOnly: true,
    docNote: 'LocalAppData only; game installs may live elsewhere.',
  },
  {
    id: 'steam-appdata',
    label: 'Steam (AppData cache)',
    category: 'game',
    destLeaf: 'Steam-Local',
    planOnly: true,
    docNote: 'LocalAppData\\Steam — not the full Steam library under Program Files.',
  },
  {
    id: 'battle-net',
    label: 'Battle.net',
    category: 'game',
    destLeaf: 'Battle-net',
    planOnly: true,
    docNote: 'LocalAppData\\Battle.net — game files may be on other drives.',
  },
  // --- Containers & package managers ---
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

export function isToolMigrationBundle(id: MigrateToolId): boolean {
  const legs = getToolMigrationProfile(id).bundleLegs;
  return Boolean(legs && legs.length > 0);
}

export function isToolMigrationPlanOnly(id: MigrateToolId): boolean {
  return getToolMigrationProfile(id).planOnly;
}

export function listToolMigrationProfilesForUi(): ToolMigrationProfile[] {
  return TOOL_MIGRATION_PROFILES.filter((p) => !p.hideFromUi);
}

function userProfileDir(): string | null {
  return process.env.USERPROFILE ?? process.env.HOME ?? null;
}

function roamingAppDataDir(): string | null {
  const fromEnv = process.env.APPDATA?.trim();
  if (fromEnv) return fromEnv;
  const profile = userProfileDir();
  return profile ? path.join(profile, 'AppData', 'Roaming') : null;
}

function localAppDataDir(): string | null {
  const fromEnv = process.env.LOCALAPPDATA?.trim();
  if (fromEnv) return fromEnv;
  const profile = userProfileDir();
  return profile ? path.join(profile, 'AppData', 'Local') : null;
}

/** Primary default source path for a profile on Windows. */
export function resolveToolDefaultSource(id: MigrateToolId): string | null {
  if (process.platform !== 'win32') return null;
  if (isToolMigrationBundle(id)) return null;

  const appData = roamingAppDataDir();
  const localAppData = localAppDataDir();
  const profile = userProfileDir();

  switch (id) {
    case 'cursor-roaming':
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
    case 'google-chrome':
      return localAppData
        ? path.join(localAppData, 'Google', 'Chrome', 'User Data')
        : null;
    case 'microsoft-edge':
      return localAppData
        ? path.join(localAppData, 'Microsoft', 'Edge', 'User Data')
        : null;
    case 'brave':
      return localAppData
        ? path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data')
        : null;
    case 'firefox':
      return appData ? path.join(appData, 'Mozilla', 'Firefox') : null;
    case 'discord-roaming':
      return appData ? path.join(appData, 'discord') : null;
    case 'discord-local':
      return localAppData ? path.join(localAppData, 'Discord') : null;
    case 'spotify':
      return appData ? path.join(appData, 'Spotify') : null;
    case 'slack':
      return appData ? path.join(appData, 'Slack') : null;
    case 'telegram':
      return appData ? path.join(appData, 'Telegram Desktop') : null;
    case 'notion':
      return appData ? path.join(appData, 'Notion') : null;
    case 'obs-studio':
      return appData ? path.join(appData, 'obs-studio') : null;
    case 'epic-games':
      return localAppData ? path.join(localAppData, 'EpicGamesLauncher') : null;
    case 'steam-appdata':
      return localAppData ? path.join(localAppData, 'Steam') : null;
    case 'battle-net':
      return localAppData ? path.join(localAppData, 'Battle.net') : null;
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

export type ResolvedBundleLeg = {
  readonly leg: string;
  readonly sourceProfileId: string;
  readonly source: string;
  readonly dest: string;
  readonly destLeaf: string;
};

/** Resolve source/dest for each leg of a bundle profile. */
export function resolveToolBundleLegs(
  id: MigrateToolId,
  destRoot: string,
): { readonly legs: ResolvedBundleLeg[]; readonly errors: string[] } {
  const profile = getToolMigrationProfile(id);
  const bundleLegs = profile.bundleLegs;
  if (!bundleLegs?.length) {
    return { legs: [], errors: [`Profile ${id} is not a bundle.`] };
  }

  const errors: string[] = [];
  const legs: ResolvedBundleLeg[] = [];
  const root = path.resolve(destRoot);

  for (const spec of bundleLegs) {
    const sourceProfileId = spec.sourceProfileId as MigrateToolId;
    const source = resolveToolDefaultSource(sourceProfileId);
    if (!source) {
      errors.push(`Could not resolve source for leg "${spec.leg}" (${spec.sourceProfileId}).`);
      continue;
    }
    legs.push({
      leg: spec.leg,
      sourceProfileId: spec.sourceProfileId,
      source: path.resolve(source),
      dest: path.join(root, spec.destLeaf),
      destLeaf: spec.destLeaf,
    });
  }

  return { legs, errors };
}
