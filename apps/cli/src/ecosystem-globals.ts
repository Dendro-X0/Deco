import { access, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DiscoveredTarget } from './scan.js';

const execFileAsync = promisify(execFile);

/** Avoid hanging scans/CI when a toolchain binary is missing or blocks on first run. */
const COMMAND_TIMEOUT_MS = 3_000;

async function pathExists(dir: string): Promise<boolean> {
  try {
    const st = await stat(dir);
    return st.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
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
    const { stdout } = await execFileAsync('pnpm', ['store', 'path'], {
      windowsHide: true,
      timeout: COMMAND_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });
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
    const { stdout } = await execFileAsync(bin, args, {
      windowsHide: true,
      timeout: COMMAND_TIMEOUT_MS,
      killSignal: 'SIGKILL',
    });
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
  if (!process.env.CONDA_PKGS_DIRS?.trim()) {
    const fromConda = await commandStdoutPath('conda', ['info', '--base']);
    if (fromConda) {
      paths.push(path.join(path.dirname(fromConda), 'pkgs'));
    }
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

function cargoHomeDir(): string | undefined {
  if (process.env.CARGO_HOME?.trim()) {
    return process.env.CARGO_HOME.trim();
  }
  return path.join(os.homedir(), '.cargo');
}

async function isCargoRegistryRoot(dir: string): Promise<boolean> {
  return hasSubdir(dir, 'cache');
}

async function bunCacheCandidatePaths(): Promise<string[]> {
  const paths: string[] = [];
  if (process.env.BUN_INSTALL_CACHE_DIR?.trim()) {
    paths.push(process.env.BUN_INSTALL_CACHE_DIR.trim());
  }
  paths.push(path.join(os.homedir(), '.bun', 'install', 'cache'));
  return dedupePaths(paths);
}

async function isBunCacheRoot(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  try {
    const entries = await readdir(dir);
    return entries.length > 0;
  } catch {
    return false;
  }
}

function nugetPackagesCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.NUGET_PACKAGES?.trim()) {
    paths.push(process.env.NUGET_PACKAGES.trim());
  }
  paths.push(path.join(os.homedir(), '.nuget', 'packages'));
  return dedupePaths(paths);
}

async function isNugetPackagesRoot(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  if (path.basename(dir) !== 'packages') return false;
  try {
    const packages = await readdir(dir, { withFileTypes: true });
    const pkg = packages.find((e) => e.isDirectory());
    if (!pkg) return false;
    const versions = await readdir(path.join(dir, pkg.name), { withFileTypes: true });
    return versions.some((e) => e.isDirectory());
  } catch {
    return false;
  }
}

export async function discoverCargoRegistryCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  const home = cargoHomeDir();
  if (!home) return out;
  const registry = path.join(home, 'registry');
  if (await isCargoRegistryRoot(registry)) {
    await pushDir(out, registry, 'cargo-registry-cache');
  }
  return out;
}

export async function discoverBunGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of await bunCacheCandidatePaths()) {
    if (await isBunCacheRoot(candidate)) {
      await pushDir(out, candidate, 'bun-global-cache');
    }
  }
  return out;
}

function composerCacheCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.COMPOSER_CACHE_DIR?.trim()) {
    paths.push(process.env.COMPOSER_CACHE_DIR.trim());
  }
  if (process.env.COMPOSER_HOME?.trim()) {
    paths.push(path.join(process.env.COMPOSER_HOME.trim(), 'cache'));
  }
  paths.push(path.join(os.homedir(), '.composer', 'cache'));
  if (process.platform !== 'win32') {
    paths.push(path.join(os.homedir(), '.cache', 'composer'));
  } else if (process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'Composer', 'cache'));
  }
  return dedupePaths(paths);
}

async function isComposerCacheRoot(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  return (await hasSubdir(dir, 'files')) || (await hasSubdir(dir, 'repo'));
}

export async function discoverComposerGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of composerCacheCandidatePaths()) {
    if (await isComposerCacheRoot(candidate)) {
      await pushDir(out, candidate, 'composer-global-cache');
    }
  }
  return out;
}

export async function discoverNugetGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of nugetPackagesCandidatePaths()) {
    if (await isNugetPackagesRoot(candidate)) {
      await pushDir(out, candidate, 'nuget-global-cache');
    }
  }
  return out;
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

function vcpkgRootCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.VCPKG_ROOT?.trim()) {
    paths.push(process.env.VCPKG_ROOT.trim());
  }
  paths.push(path.join(os.homedir(), 'vcpkg'));
  if (process.platform === 'win32') {
    paths.push('C:\\vcpkg');
  }
  return dedupePaths(paths);
}

async function isVcpkgRoot(dir: string): Promise<boolean> {
  return (
    (await pathExists(dir)) &&
    ((await fileExists(path.join(dir, '.vcpkg-root'))) || (await fileExists(path.join(dir, 'vcpkg.json'))))
  );
}

async function isVcpkgInstalledTree(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  if (path.basename(dir) !== 'installed') return false;
  const parent = path.dirname(dir);
  return isVcpkgRoot(parent);
}

export async function discoverVcpkgInstalledCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const root of vcpkgRootCandidatePaths()) {
    if (!(await isVcpkgRoot(root))) continue;
    const installed = path.join(root, 'installed');
    if (await isVcpkgInstalledTree(installed)) {
      await pushDir(out, installed, 'vcpkg-installed-cache');
    }
  }
  return out;
}

function conanHomeCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.CONAN_HOME?.trim()) {
    paths.push(process.env.CONAN_HOME.trim());
  }
  paths.push(path.join(os.homedir(), '.conan2'));
  return dedupePaths(paths);
}

async function isConanHome(dir: string): Promise<boolean> {
  return (
    (await pathExists(dir)) &&
    ((await fileExists(path.join(dir, 'remotes.json'))) || (await pathExists(path.join(dir, 'profiles'))))
  );
}

async function isConanPackageCache(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  if (path.basename(dir) !== 'p') return false;
  return isConanHome(path.dirname(dir));
}

export async function discoverConanGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const home of conanHomeCandidatePaths()) {
    if (!(await isConanHome(home))) continue;
    const pkg = path.join(home, 'p');
    if (await isConanPackageCache(pkg)) {
      await pushDir(out, pkg, 'conan-global-cache');
    }
  }
  return out;
}

function ccacheCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.CCACHE_DIR?.trim()) {
    paths.push(process.env.CCACHE_DIR.trim());
  }
  paths.push(path.join(os.homedir(), '.cache', 'ccache'));
  if (process.platform === 'darwin') {
    paths.push(path.join(os.homedir(), 'Library', 'Caches', 'ccache'));
  } else if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    paths.push(path.join(process.env.LOCALAPPDATA, 'ccache'));
  }
  return dedupePaths(paths);
}

async function isCcacheRoot(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  if (await fileExists(path.join(dir, 'stats'))) return true;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries.some((e) => e.isDirectory());
  } catch {
    return false;
  }
}

export async function discoverCcacheGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of ccacheCandidatePaths()) {
    if (await isCcacheRoot(candidate)) {
      await pushDir(out, candidate, 'ccache-global-cache');
    }
  }
  return out;
}

function sccacheCandidatePaths(): string[] {
  const paths: string[] = [];
  if (process.env.SCCACHE_DIR?.trim()) {
    paths.push(process.env.SCCACHE_DIR.trim());
  }
  paths.push(path.join(os.homedir(), '.cache', 'sccache'));
  return dedupePaths(paths);
}

async function isSccacheRoot(dir: string): Promise<boolean> {
  return (await pathExists(dir)) && (await pathExists(path.join(dir, 'cache')));
}

export async function discoverSccacheGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const out: DiscoveredTarget[] = [];
  for (const candidate of sccacheCandidatePaths()) {
    if (await isSccacheRoot(candidate)) {
      await pushDir(out, candidate, 'sccache-global-cache');
    }
  }
  return out;
}

async function isBazelDiskCacheRoot(dir: string): Promise<boolean> {
  if (!(await pathExists(dir))) return false;
  return (await hasSubdir(dir, 'cas')) || (await hasSubdir(dir, 'ac'));
}

/** Only when `BAZEL_DISK_CACHE` is set to a directory with Bazel disk-cache layout (`cas` / `ac`). */
export async function discoverBazelDiskGlobalCachesIfEnabled(enabled: boolean): Promise<DiscoveredTarget[]> {
  if (!enabled) return [];
  const raw = process.env.BAZEL_DISK_CACHE?.trim();
  if (!raw) return [];
  const out: DiscoveredTarget[] = [];
  if (await isBazelDiskCacheRoot(raw)) {
    await pushDir(out, raw, 'bazel-disk-cache');
  }
  return out;
}
