import { stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { DiscoveredTarget } from './scan.js';

async function pathExists(dir: string): Promise<boolean> {
  try {
    const st = await stat(dir);
    return st.isDirectory();
  } catch {
    return false;
  }
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
      path.join(homeLibrary(), 'Developer', 'Xcode', 'DerivedData'),
      'ide-global-cache'
    );
  } else if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    await pushDir(
      out,
      path.join(process.env.LOCALAPPDATA, 'Xcode', 'DerivedData'),
      'ide-global-cache'
    );
  }
  return out;
}

function homeLibrary(): string {
  return path.join(os.homedir(), 'Library');
}
