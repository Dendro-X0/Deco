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
  return `Deco will close these processes when you Run migration: ${running.join(', ')}.`;
}

export type CloseProcessesOutcome = {
  readonly closed: readonly string[];
  readonly still_running: readonly string[];
};

/** Force-close tool processes (CCleaner-style) so rename/junction can proceed. */
export function closeRunningToolProcesses(id: MigrateToolId): CloseProcessesOutcome {
  if (process.platform !== 'win32') {
    return { closed: [], still_running: detectRunningToolProcesses(id) };
  }
  const targets = detectRunningToolProcesses(id);
  if (targets.length === 0) {
    return { closed: [], still_running: [] };
  }

  const closed: string[] = [];
  for (const image of targets) {
    try {
      execSync(`taskkill /F /T /IM "${image}"`, {
        encoding: 'utf8',
        timeout: 30_000,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
    } catch {
      // taskkill exits non-zero when the process already exited — continue.
    }
    closed.push(image);
  }

  const sleep = (ms: number) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      /* busy wait — CLI has no async requirement here */
    }
  };

  for (let i = 0; i < 10; i++) {
    sleep(500);
    const still = detectRunningToolProcesses(id);
    if (still.length === 0) break;
    for (const image of still) {
      try {
        execSync(`taskkill /F /T /IM "${image}"`, {
          encoding: 'utf8',
          timeout: 30_000,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        });
      } catch {
        // ignore
      }
    }
  }

  sleep(1500);
  return { closed, still_running: detectRunningToolProcesses(id) };
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
