import { lstat, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { TaskQueue } from './concurrency.js';
import {
  dirHasCppNativeMarker,
  hasCmakeProjectAncestor,
  hasCppNativeProjectAncestor,
  hasMesonProjectAncestor,
  hasBazelProjectAncestor,
  hasPremakeProjectAncestor,
  hasQmakeProjectAncestor,
  hasXmakeProjectAncestor,
  isBazelOutputDirName,
  isCppIdeDirName,
  isMesonBuildDirName,
  isPremakeBuildDirName,
  isQmakeShadowBuildDirName,
  isXmakeBuildDirName,
  hasDotnetProjectAncestor,
  hasGoModAncestor,
  hasJvmProjectAncestor,
  hasPythonProjectAncestor,
  isMsvcArchDirName,
  isMsvcConfigDirName,
} from './project-detection.js';
import type { CliOptions, ProgressListener, TargetDirKind } from './types.js';

export type DiscoveredTarget = {
  readonly kind: TargetDirKind;
  readonly absPath: string;
  readonly mtimeMs?: number;
};

export type DiscoveryResult = {
  readonly targets: readonly DiscoveredTarget[];
  readonly scannedDirs: number;
  readonly errors: readonly string[];
  /** Symlink/junction directories not descended into (avoids cycles / escape). */
  readonly skippedSymlinkDirTraversal: number;
};

type DiscoveryState = {
  scannedDirs: number;
  foundTargets: number;
  skippedSymlinkDirTraversal: number;
  readonly errors: string[];
  readonly queue: TaskQueue;
  readonly onProgress?: ProgressListener;
};

const FS_CONCURRENCY = 32;

const BASE_BUILD_ARTIFACT_DIR_NAMES: readonly string[] = [
  '.next',
  '.svelte-kit',
  '.astro',
  '.cache',
  'dist',
  'build',
  'dist-firefox',
] as const;
const BASE_PLAYWRIGHT_DIR_NAMES: readonly string[] = ['test-results', 'playwright-report'] as const;
const BASE_RUST_DIR_NAMES: readonly string[] = ['target', '.cargo-target', 'pkg'] as const;
const BASE_GO_DIR_NAMES: readonly string[] = ['bin', 'dist', 'build', 'bin-win'] as const;

/** Do not recurse into these dirs during discovery (see docs/milestones/milestone-5.md). */
export const SKIP_DESCENT_DIR_NAMES: readonly string[] = [
  'node_modules',
  'target',
  '.git',
  '.next',
  '.svelte-kit',
  '.astro',
  '.cache',
  'dist',
  'build',
  'dist-firefox',
  '.cargo-target',
  'pkg',
  'vendor',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  'venv',
  '.venv',
  'obj',
  '.cxx',
] as const;

const SKIP_DESCENT = new Set<string>(SKIP_DESCENT_DIR_NAMES);
const AGGRESSIVE_UNKNOWN_DIR_NAMES: readonly string[] = [
  '.turbo',
  '.vite',
  '.nuxt',
  '.parcel-cache',
  '.eslintcache',
  '.tmp',
  'tmp',
  'temp',
  'cache',
] as const;

function mergedNames(base: readonly string[], extra: readonly string[], includeExtra: boolean): Set<string> {
  const set = new Set(base);
  if (includeExtra) {
    for (const name of extra) set.add(name);
  }
  return set;
}

async function shouldTargetDir(
  dirName: string,
  parentAbsPath: string,
  options: CliOptions
): Promise<TargetDirKind | null> {
  const buildNames = mergedNames(
    BASE_BUILD_ARTIFACT_DIR_NAMES,
    options.additionalDirNames.buildArtifacts,
    options.profile !== 'safe'
  );
  const rustNames = mergedNames(BASE_RUST_DIR_NAMES, options.additionalDirNames.rustArtifacts, options.profile !== 'safe');
  const goNames = mergedNames(BASE_GO_DIR_NAMES, options.additionalDirNames.goArtifacts, options.profile !== 'safe');
  const playwrightNames = mergedNames(
    BASE_PLAYWRIGHT_DIR_NAMES,
    options.additionalDirNames.playwrightArtifacts,
    options.profile !== 'safe'
  );

  const needsGo = goNames.has(dirName);
  const needsPy =
    options.includePythonArtifacts &&
    (dirName === '__pycache__' ||
      dirName === '.pytest_cache' ||
      dirName === '.mypy_cache' ||
      dirName === '.ruff_cache' ||
      dirName === '.tox' ||
      dirName.endsWith('.egg-info') ||
      dirName === 'dist' ||
      dirName === 'build');
  const needsJvm = options.includeJvmArtifacts && (dirName === 'build' || dirName === 'dist');
  const needsDotnet = options.includeDotnetArtifacts && (dirName === 'bin' || dirName === 'obj');
  const [hasGo, hasPy, hasJvm, hasDotnet] = await Promise.all([
    needsGo ? hasGoModAncestor(parentAbsPath, 6) : Promise.resolve(false),
    needsPy || (options.includePythonVenv && (dirName === 'venv' || dirName === '.venv'))
      ? hasPythonProjectAncestor(parentAbsPath, 6)
      : Promise.resolve(false),
    needsJvm ? hasJvmProjectAncestor(parentAbsPath, 6) : Promise.resolve(false),
    needsDotnet ? hasDotnetProjectAncestor(parentAbsPath, 6) : Promise.resolve(false),
  ]);

  if (options.includePythonVenv && (dirName === 'venv' || dirName === '.venv') && hasPy) {
    return 'python-venv';
  }

  if (options.includeDotnetArtifacts && (dirName === 'bin' || dirName === 'obj') && hasDotnet && !hasGo) {
    return 'dotnet-artifact';
  }

  if (options.includeNodeModules && dirName === 'node_modules') return 'node_modules';
  if (options.includePlaywrightArtifacts && playwrightNames.has(dirName)) return 'playwright-artifact';
  if (options.includeRustArtifacts && rustNames.has(dirName)) return 'rust-artifact';

  if (options.includeGoArtifacts && goNames.has(dirName)) {
    if (dirName === 'bin' || dirName === 'dist' || dirName === 'build' || dirName === 'bin-win') {
      if (hasGo) return 'go-artifact';
    } else if (hasGo) {
      return 'go-artifact';
    }
  }

  if (options.includePythonArtifacts) {
    if (
      (dirName === '__pycache__' ||
        dirName === '.pytest_cache' ||
        dirName === '.mypy_cache' ||
        dirName === '.ruff_cache' ||
        dirName === '.tox' ||
        dirName.endsWith('.egg-info')) &&
      hasPy
    ) {
      return 'python-artifact';
    }
  }

  if (dirName === 'dist' || dirName === 'build') {
    if (hasGo) return 'go-artifact';
    if (options.includeJvmArtifacts && hasJvm) return 'jvm-artifact';
    if (options.includePythonArtifacts && hasPy) return 'python-artifact';
    if (options.includeBuildArtifacts) return 'build-artifact';
    return null;
  }

  if (options.includeBuildArtifacts && buildNames.has(dirName)) {
    return 'build-artifact';
  }

  if (options.profile !== 'safe') {
    if (dirName.startsWith('cmake-build-')) {
      if (await hasCmakeProjectAncestor(parentAbsPath, 6)) {
        return 'build-artifact';
      }
    }
    if (dirName === 'out') {
      if (
        (await hasCmakeProjectAncestor(parentAbsPath, 6)) ||
        (await hasMesonProjectAncestor(parentAbsPath, 6))
      ) {
        return 'build-artifact';
      }
    }
    if (isMesonBuildDirName(dirName)) {
      if (await hasMesonProjectAncestor(parentAbsPath, 6)) {
        return 'build-artifact';
      }
    }
    if (isCppIdeDirName(dirName)) {
      if (await hasCppNativeProjectAncestor(parentAbsPath, 6)) {
        return 'build-artifact';
      }
    }
    if (isBazelOutputDirName(dirName)) {
      if (await hasBazelProjectAncestor(parentAbsPath, 6)) {
        return 'build-artifact';
      }
    }
    if (dirName === '.cxx') {
      if (await hasJvmProjectAncestor(parentAbsPath, 6)) {
        return 'build-artifact';
      }
    }
    if (isXmakeBuildDirName(dirName)) {
      if (await hasXmakeProjectAncestor(parentAbsPath, 6)) {
        return 'build-artifact';
      }
    }
    if (isPremakeBuildDirName(dirName)) {
      if (await hasPremakeProjectAncestor(parentAbsPath, 6)) {
        return 'build-artifact';
      }
    }
    if (isQmakeShadowBuildDirName(dirName)) {
      if (await hasQmakeProjectAncestor(parentAbsPath, 6)) {
        return 'build-artifact';
      }
    }
    if (dirName === 'obj') {
      if (
        (await hasPremakeProjectAncestor(parentAbsPath, 6)) &&
        !(await hasDotnetProjectAncestor(parentAbsPath, 6))
      ) {
        return 'build-artifact';
      }
    }
    if (isMsvcConfigDirName(dirName)) {
      const hasCpp = await hasCppNativeProjectAncestor(parentAbsPath, 6);
      if (hasCpp) {
        const parentName = path.basename(parentAbsPath);
        if (
          isMsvcArchDirName(parentName) ||
          (await dirHasCppNativeMarker(parentAbsPath))
        ) {
          return 'build-artifact';
        }
        if (options.profile === 'aggressive') {
          return 'build-artifact';
        }
      }
    }
  }

  if (options.profile === 'aggressive' && AGGRESSIVE_UNKNOWN_DIR_NAMES.includes(dirName)) {
    return 'unknown-artifact';
  }

  return null;
}

/** Deduplicate scan roots (case-insensitive on Windows). */
export function dedupeScanRoots(roots: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of roots) {
    const resolved = path.resolve(r);
    const key = process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved);
  }
  return out;
}

function printProgress(state: DiscoveryState): void {
  if (!state.onProgress) return;
  state.onProgress({
    phase: 'discover',
    scannedDirs: state.scannedDirs,
    foundTargets: state.foundTargets,
  });
}

/**
 * Collapse targets that resolve to the same real path (symlinks, junctions, duplicate roots).
 * Appends short notes to `errors` (same channel as scan permission warnings).
 */
export async function dedupeDiscoveredByRealpath(
  targets: readonly DiscoveredTarget[],
  errors: string[]
): Promise<DiscoveredTarget[]> {
  const seen = new Set<string>();
  const kept: DiscoveredTarget[] = [];
  for (const t of targets) {
    let key: string;
    try {
      key = await realpath(t.absPath);
    } catch {
      key = path.resolve(t.absPath);
    }
    const norm = process.platform === 'win32' ? key.toLowerCase() : key;
    if (seen.has(norm)) {
      errors.push(`Skipped duplicate target (same physical path as an earlier candidate): ${t.absPath}`);
      continue;
    }
    seen.add(norm);
    kept.push(t);
  }
  return kept;
}

export async function discoverTargets(
  options: CliOptions,
  pathPolicy: { shouldPrune: (absPath: string) => boolean },
  onProgress?: ProgressListener
): Promise<DiscoveryResult> {
  const state: DiscoveryState = {
    scannedDirs: 0,
    foundTargets: 0,
    skippedSymlinkDirTraversal: 0,
    errors: [],
    queue: new TaskQueue(FS_CONCURRENCY),
    onProgress,
  };
  const targets: DiscoveredTarget[] = [];
  const uniqueRoots = dedupeScanRoots(options.roots);

  async function scanDir(absPath: string, depth: number): Promise<void> {
    if (depth > options.maxDepth) return;
    if (pathPolicy.shouldPrune(absPath)) return;
    for (const pattern of options.excludeAbsPathContains) {
      if (absPath.includes(pattern)) return;
    }

    state.scannedDirs += 1;
    printProgress(state);

    let entries: readonly import('node:fs').Dirent[];
    try {
      entries = await state.queue.run(() => readdir(absPath, { withFileTypes: true }));
    } catch (error: unknown) {
      state.errors.push(`Scan error: ${absPath} (${(error as { code?: string }).code ?? 'unknown'})`);
      return;
    }

    const tasks = entries.map(async (entry) => {
      if (!entry.isDirectory()) return;
      const entryAbsPath = path.join(absPath, entry.name);
      let linkStat: import('node:fs').Stats;
      try {
        linkStat = await state.queue.run(() => lstat(entryAbsPath));
      } catch (error: unknown) {
        state.errors.push(`Scan error: ${entryAbsPath} (${(error as { code?: string }).code ?? 'unknown'})`);
        return;
      }

      if (linkStat.isSymbolicLink()) {
        state.skippedSymlinkDirTraversal += 1;
        const kind = await shouldTargetDir(entry.name, entryAbsPath, options);
        if (kind) {
          let mtimeMs: number | undefined;
          try {
            const st = await state.queue.run(() => stat(entryAbsPath));
            mtimeMs = st.mtimeMs;
          } catch {
            mtimeMs = undefined;
          }
          targets.push({ kind, absPath: entryAbsPath, mtimeMs });
          state.foundTargets += 1;
          printProgress(state);
        }
        return;
      }

      const kind = await shouldTargetDir(entry.name, entryAbsPath, options);
      if (kind) {
        let mtimeMs: number | undefined;
        try {
          const st = await state.queue.run(() => stat(entryAbsPath));
          mtimeMs = st.mtimeMs;
        } catch {
          mtimeMs = undefined;
        }
        targets.push({ kind, absPath: entryAbsPath, mtimeMs });
        state.foundTargets += 1;
        printProgress(state);
      }

      if (SKIP_DESCENT.has(entry.name)) {
        return;
      }

      if (kind) {
        return;
      }
      return scanDir(entryAbsPath, depth + 1);
    });

    await Promise.all(tasks);
  }

  for (const root of uniqueRoots) {
    await scanDir(path.resolve(root), 0);
  }

  return {
    targets,
    scannedDirs: state.scannedDirs,
    errors: state.errors,
    skippedSymlinkDirTraversal: state.skippedSymlinkDirTraversal,
  };
}

export async function getDirSizeBytes(
  absPath: string,
  queue: TaskQueue,
  errors: string[],
  visited?: Set<string>
): Promise<number> {
  const vis = visited ?? new Set<string>();
  let canonKey: string;
  try {
    canonKey = await realpath(absPath);
  } catch {
    canonKey = path.resolve(absPath);
  }
  const keyNorm = process.platform === 'win32' ? canonKey.toLowerCase() : canonKey;
  if (vis.has(keyNorm)) {
    return 0;
  }
  vis.add(keyNorm);

  let total = 0;
  try {
    const entries = await queue.run(() => readdir(absPath, { withFileTypes: true }));
    const tasks = entries.map(async (entry) => {
      const entryAbsPath = path.join(absPath, entry.name);
      let lst: import('node:fs').Stats;
      try {
        lst = await queue.run(() => lstat(entryAbsPath));
      } catch (error: unknown) {
        errors.push(`Size error: ${entryAbsPath} (${(error as { code?: string }).code ?? 'unknown'})`);
        return 0;
      }
      if (lst.isSymbolicLink()) {
        return lst.size;
      }
      if (lst.isDirectory()) {
        return getDirSizeBytes(entryAbsPath, queue, errors, vis);
      }
      if (lst.isFile()) {
        return lst.size;
      }
      return 0;
    });
    const results = await Promise.all(tasks);
    total = results.reduce((a, b) => a + b, 0);
  } catch (error: unknown) {
    errors.push(`Size error: ${absPath} (${(error as { code?: string }).code ?? 'unknown'})`);
  }
  return total;
}

export const SCAN_FS_CONCURRENCY = FS_CONCURRENCY;
