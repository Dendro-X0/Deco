import { access, stat } from 'node:fs/promises';
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

async function commandStdoutPath(bin: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(bin, args, { windowsHide: true });
    const value = stdout.trim();
    return value || null;
  } catch {
    return null;
  }
}

function yarnCacheCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.YARN_CACHE_FOLDER?.trim()) {
    paths.push(process.env.YARN_CACHE_FOLDER.trim());
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'Yarn', 'Cache'));
  } else if (process.platform === 'darwin') {
    paths.push(path.join(os.homedir(), 'Library', 'Caches', 'Yarn'));
  } else {
    paths.push(path.join(os.homedir(), '.cache', 'yarn'));
  }
  return dedupePaths(paths);
}

function pipCacheCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.PIP_CACHE_DIR?.trim()) {
    paths.push(process.env.PIP_CACHE_DIR.trim());
  }
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'pip', 'Cache'));
  } else {
    paths.push(path.join(os.homedir(), '.cache', 'pip'));
  }
  return dedupePaths(paths);
}

async function uvCacheCandidatePaths(): Promise<string[]> {
  const paths: string[] = [];
  if (process.env.UV_CACHE_DIR?.trim()) {
    paths.push(process.env.UV_CACHE_DIR.trim());
  }
  const fromCli = await commandStdoutPath('uv', ['cache', 'dir']);
  if (fromCli) paths.push(fromCli);
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'uv', 'cache'));
  } else {
    paths.push(path.join(os.homedir(), '.cache', 'uv'));
  }
  return dedupePaths(paths);
}

async function isYarnCacheRoot(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  if (await hasSubdir(dir, 'v6')) return true;
  return pathExists(path.join(dir, 'berry', 'cache'));
}

async function isPipCacheRoot(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  return (await hasSubdir(dir, 'wheels')) || (await hasSubdir(dir, 'http'));
}

async function isUvCacheRoot(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  return (await hasSubdir(dir, 'archive-v0')) || (await hasSubdir(dir, 'downloads-v0'));
}

export async function discoverYarnGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  const fromCli = await commandStdoutPath('yarn', ['cache', 'dir']);
  const candidates = dedupePaths(fromCli ? [...yarnCacheCandidatePaths(), fromCli] : yarnCacheCandidatePaths());
  for (const candidate of candidates) {
    if (await isYarnCacheRoot(candidate)) {
      await pushDir(out, candidate, 'yarn-global-cache');
    }
  }
  return out;
}

export async function discoverPipGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of pipCacheCandidatePaths()) {
    if (await isPipCacheRoot(candidate)) {
      await pushDir(out, candidate, 'pip-global-cache');
    }
  }
  return out;
}

export async function discoverUvGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of await uvCacheCandidatePaths()) {
    if (await isUvCacheRoot(candidate)) {
      await pushDir(out, candidate, 'uv-global-cache');
    }
  }
  return out;
}

function isCondaEnvsPath(dir: string): boolean {
  const normalized = path.resolve(dir).replace(/\\/g, '/').toLowerCase();
  return normalized.includes('/envs/') || normalized.endsWith('/envs');
}

async function isCondaPkgsCache(dir: string): Promise<boolean> {
  if (isCondaEnvsPath(dir) || !(await pathExists(dir))) return false;
  try {
    await access(path.join(dir, 'urls.txt'));
    return true;
  } catch {
    return hasSubdir(dir, 'cache');
  }
}

function condaPkgsCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.CONDA_PKGS_DIRS?.trim()) {
    for (const part of process.env.CONDA_PKGS_DIRS.split(path.delimiter)) {
      const trimmed = part.trim();
      if (trimmed) paths.push(trimmed);
    }
  }
  return dedupePaths(paths);
}

async function condaPkgsCandidatePathsAsync(): Promise<string[]> {
  const paths = condaPkgsCandidatePaths();
  const fromConda = await commandStdoutPath('conda', ['info', '--base']);
  if (fromConda) {
    paths.push(path.join(path.dirname(fromConda), 'pkgs'));
  }
  const home = os.homedir();
  for (const installName of [
    'miniconda3',
    'miniforge3',
    'mambaforge',
    'anaconda3',
    'miniconda',
    'anaconda',
  ]) {
    paths.push(path.join(home, installName, 'pkgs'));
  }
  return dedupePaths(paths);
}

export async function discoverCondaPkgsCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of await condaPkgsCandidatePathsAsync()) {
    if (await isCondaPkgsCache(candidate)) {
      await pushDir(out, candidate, 'conda-pkgs-cache');
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
