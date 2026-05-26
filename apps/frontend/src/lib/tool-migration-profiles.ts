/** UI list — keep IDs aligned with apps/cli/src/tool-migration-profiles.ts */
export const TOOL_MIGRATION_UI_PROFILES = [
  { id: 'cursor', label: 'Cursor (Roaming)', planOnly: false },
  { id: 'cursor-local', label: 'Cursor (Local cache)', planOnly: false },
  { id: 'vscode', label: 'VS Code', planOnly: false },
  { id: 'claude-code', label: 'Claude Code', planOnly: false },
  { id: 'codex-cli', label: 'OpenAI Codex CLI', planOnly: false },
  { id: 'claude-desktop', label: 'Claude Desktop (plan only)', planOnly: true },
  { id: 'docker-desktop', label: 'Docker Desktop (plan only)', planOnly: true },
  { id: 'npm-cache', label: 'npm cache (plan only)', planOnly: true },
  { id: 'pnpm-store', label: 'pnpm store (plan only)', planOnly: true },
] as const;

export type ToolMigrationUiId = (typeof TOOL_MIGRATION_UI_PROFILES)[number]['id'];
