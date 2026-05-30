/** UI catalog — keep IDs aligned with apps/cli/src/tool-migration-profiles.ts */

export type ToolMigrationCategory =
  | 'agent'
  | 'ide'
  | 'browser'
  | 'utility'
  | 'game'
  | 'container'
  | 'package-manager';

export type ToolMigrationUiProfile = {
  id: string;
  label: string;
  category: ToolMigrationCategory;
  planOnly: boolean;
};

export const TOOL_MIGRATION_CATEGORY_ORDER: readonly ToolMigrationCategory[] = [
  'agent',
  'ide',
  'browser',
  'utility',
  'game',
  'container',
  'package-manager',
];

export const TOOL_MIGRATION_UI_PROFILES: readonly ToolMigrationUiProfile[] = [
  { id: 'cursor', label: 'Cursor (Roaming + Local)', category: 'agent', planOnly: false },
  { id: 'claude-code', label: 'Claude Code', category: 'agent', planOnly: false },
  { id: 'codex-cli', label: 'OpenAI Codex CLI', category: 'agent', planOnly: false },
  { id: 'claude-desktop', label: 'Claude Desktop (plan only)', category: 'agent', planOnly: true },
  { id: 'vscode', label: 'VS Code', category: 'ide', planOnly: false },
  { id: 'google-chrome', label: 'Google Chrome (User Data)', category: 'browser', planOnly: false },
  { id: 'microsoft-edge', label: 'Microsoft Edge (User Data)', category: 'browser', planOnly: false },
  { id: 'brave', label: 'Brave (User Data)', category: 'browser', planOnly: false },
  { id: 'firefox', label: 'Mozilla Firefox (plan only)', category: 'browser', planOnly: true },
  { id: 'discord', label: 'Discord (Roaming + Local)', category: 'utility', planOnly: false },
  { id: 'spotify', label: 'Spotify', category: 'utility', planOnly: false },
  { id: 'slack', label: 'Slack', category: 'utility', planOnly: false },
  { id: 'telegram', label: 'Telegram Desktop', category: 'utility', planOnly: false },
  { id: 'notion', label: 'Notion', category: 'utility', planOnly: false },
  { id: 'obs-studio', label: 'OBS Studio', category: 'utility', planOnly: false },
  { id: 'epic-games', label: 'Epic Games Launcher (plan only)', category: 'game', planOnly: true },
  { id: 'steam-appdata', label: 'Steam AppData cache (plan only)', category: 'game', planOnly: true },
  { id: 'battle-net', label: 'Battle.net (plan only)', category: 'game', planOnly: true },
  { id: 'docker-desktop', label: 'Docker Desktop (plan only)', category: 'container', planOnly: true },
  { id: 'npm-cache', label: 'npm cache (plan only)', category: 'package-manager', planOnly: true },
  { id: 'pnpm-store', label: 'pnpm store (plan only)', category: 'package-manager', planOnly: true },
] as const;

export type ToolMigrationUiId = (typeof TOOL_MIGRATION_UI_PROFILES)[number]['id'];

export function toolMigrationProfilesByCategory(): Array<{
  category: ToolMigrationCategory;
  profiles: ToolMigrationUiProfile[];
}> {
  return TOOL_MIGRATION_CATEGORY_ORDER.map((category) => ({
    category,
    profiles: TOOL_MIGRATION_UI_PROFILES.filter((p) => p.category === category),
  })).filter((g) => g.profiles.length > 0);
}
