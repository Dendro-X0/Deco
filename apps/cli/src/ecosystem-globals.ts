import { stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiscoveredTarget } from './scan.js';

const execFileAsync = promisify(execFile);

async function pathExists(dir: string): Promise<boolean> {
  try {
    const st = await stat(dir);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function hasSubdir(parent: string, name: string): Promise<boolean> {
  return pathExists(path.join(parent, name));
}

async function pushDir(targets: DiscoveredTarget[], absPath: string, kind: DiscoveredTarget['kind']): Promise<void> {
  if (!(await pathExists(absPath))) return;
  let mtimeMs: number | undefined;
  try {
    mtimeMs = (await stat(absPath)).mtimeMs;
  } catch {
    mtimeMs = undefined;
  }
  targets.push({ kind, absPath, mtimeMs });
}

function dedupePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const key = path.resolve(p).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function npmCacheCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.NPM_CONFIG_CACHE?.trim()) {
    paths.push(process.env.NPM_CONFIG_CACHE.trim());
  }
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) {
      paths.push(path.join(process.env.LOCALAPPDATA, 'npm-cache'));
    }
    if (process.env.APPDATA) {
      paths.push(path.join(process.env.APPDATA, 'npm-cache'));
    }
  } else {
    paths.push(path.join(os.homedir(), '.npm'));
  }
  return dedupePaths(paths);
}

async function pnpmStoreCandidatePaths(): Promise<string[]> {
  const paths: string[] = [];
  if (process.env.PNPM_STORE_PATH?.trim()) {
    paths.push(process.env.PNPM_STORE_PATH.trim());
  }
  try {
    const { stdout } = await execFileAsync('pnpm', ['store', 'path'], { windowsHide: true });
    const value = stdout.trim();
    if (value) paths.push(value);
  } catch {
    /* pnpm not on PATH */
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'pnpm', 'store'));
  } else if (process.platform === 'darwin') {
    paths.push(path.join(os.homedir(), 'Library', 'pnpm', 'store'));
  } else {
    paths.push(path.join(os.homedir(), '.local', 'share', 'pnpm', 'store'));
  }
  return dedupePaths(paths);
}

export async function discoverNpmGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of npmCacheCandidatePaths()) {
    if (await hasSubdir(candidate, '_cacache')) {
      await pushDir(out, candidate, 'npm-global-cache');
    }
  }
  return out;
}

export async function discoverPnpmGlobalStoreIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of await pnpmStoreCandidatePaths()) {
    if (await hasSubdir(candidate, 'v3')) {
      await pushDir(out, candidate, 'pnpm-global-store');
    }
  }
  return out;
}

export async function discoverJvmGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const home = os.homedir();
  const out: DiscoveredTarget[] = [];
  await pushDir(out, path.join(home, '.m2', 'repository'), 'jvm-global-cache');
  await pushDir(out, path.join(home, '.gradle', 'caches'), 'jvm-global-cache');
  return out;
}

export async function discoverIdeGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  if (process.platform === 'darwin') {
    await pushDir(
      out,
      path.join(os.homedir(), 'Library', 'Developer', 'Xcode', 'DerivedData'),
      'ide-global-cache',
    );
  } else if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    await pushDir(
      out,
      path.join(process.env.LOCALAPPDATA, 'Xcode', 'DerivedData'),
      'ide-global-cache',
    );
  }
  return out;
}
