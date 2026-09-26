import { execSync } from 'node:child_process';
import {
  getToolMigrationProfile,
  type MigrateToolId,
} from './tool-migration-profiles.js';

const TOOL_PROCESS_IMAGE_NAMES: Partial<Record<MigrateToolId, readonly string[]>> = {
  cursor: ['Cursor.exe'],
  'cursor-roaming': ['Cursor.exe'],
  'cursor-local': ['Cursor.exe'],
  vscode: ['Code.exe'],
  'claude-code': ['claude.exe'],
  'codex-cli': ['codex.exe'],
  'claude-desktop': ['Claude.exe'],
  'google-chrome': ['chrome.exe'],
  'microsoft-edge': ['msedge.exe'],
  brave: ['brave.exe'],
  firefox: ['firefox.exe'],
  discord: ['Discord.exe'],
  'discord-roaming': ['Discord.exe'],
  'discord-local': ['Discord.exe'],
  spotify: ['Spotify.exe'],
  slack: ['slack.exe'],
  telegram: ['Telegram.exe'],
  notion: ['Notion.exe'],
  'obs-studio': ['obs64.exe', 'obs32.exe'],
  'epic-games': ['EpicGamesLauncher.exe'],
  'steam-appdata': ['steam.exe'],
  'battle-net': ['Battle.net.exe'],
  'docker-desktop': ['Docker Desktop.exe', 'com.docker.backend.exe', 'com.docker.build.exe'],
};

/** Windows image names to check before migration (deduped). */
export function processImageNamesForTool(id: MigrateToolId): readonly string[] {
  const profile = getToolMigrationProfile(id);
  if (profile.bundleLegs?.length) {
    const names = new Set<string>();
    for (const leg of profile.bundleLegs) {
      for (const name of processImageNamesForTool(leg.sourceProfileId as MigrateToolId)) {
        names.add(name);
      }
    }
    return [...names];
  }
  return TOOL_PROCESS_IMAGE_NAMES[id] ?? [];
}

function listTasklistImageNames(): string[] {
  try {
    const out = execSync('tasklist /FO CSV /NH', { encoding: 'utf8', timeout: 15_000 });
    const names: string[] = [];
    for (const line of out.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('"')) continue;
      const end = trimmed.indexOf('"', 1);
      if (end > 1) names.push(trimmed.slice(1, end));
    }
    return names;
  } catch {
    return [];
  }
}

function isWindowsProcessRunning(imageName: string): boolean {
  const needle = imageName.toLowerCase().replace(/\.exe$/i, '');
  return listTasklistImageNames().some((n) => {
    const lower = n.toLowerCase();
    return lower === imageName.toLowerCase() || lower.includes(needle);
  });
}

function detectCursorFamilyProcesses(): string[] {
  const found = listTasklistImageNames().filter((n) => {
    const lower = n.toLowerCase();
    return lower.includes('cursor') && lower.endsWith('.exe');
  });
  const uniq = [...new Set(found.map((n) => n))];
  return uniq;
}

/** Image names currently running for this tool profile (Windows only). */
export function detectRunningToolProcesses(id: MigrateToolId): string[] {
  if (process.platform !== 'win32') return [];
  if (id === 'cursor' || id === 'cursor-roaming' || id === 'cursor-local') {
    return detectCursorFamilyProcesses();
  }
  return processImageNamesForTool(id).filter((name) => isWindowsProcessRunning(name));
}

export function runningProcessWarning(running: readonly string[]): string | null {
  if (running.length === 0) return null;
  return `Close these processes before Run migration: ${running.join(', ')} (check Task Manager and the tray icon).`;
}

export function enrichPlanWithRunningProcesses<
  T extends { readonly warnings: readonly string[]; readonly running_processes?: readonly string[] },
>(
  tool: MigrateToolId | undefined,
  plan: T,
): T {
  if (!tool || process.platform !== 'win32') return plan;
  const running = detectRunningToolProcesses(tool);
  const warning = runningProcessWarning(running);
  if (!warning) return { ...plan, running_processes: [] };
  return {
    ...plan,
    running_processes: [...running],
    warnings: plan.warnings.includes(warning) ? plan.warnings : [...plan.warnings, warning],
  };
}
