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

function isWindowsProcessRunning(imageName: string): boolean {
  try {
    const out = execSync(`tasklist /FI "IMAGENAME eq ${imageName}" /NH`, {
      encoding: 'utf8',
      timeout: 15_000,
    });
    if (/INFO:\s*No tasks are running/i.test(out)) return false;
    return out.toLowerCase().includes(imageName.toLowerCase());
  } catch {
    return false;
  }
}

/** Image names currently running for this tool profile (Windows only). */
export function detectRunningToolProcesses(id: MigrateToolId): string[] {
  if (process.platform !== 'win32') return [];
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
