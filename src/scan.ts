import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { TaskQueue } from './concurrency.js';
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
};

type DiscoveryState = {
  scannedDirs: number;
  foundTargets: number;
  readonly errors: string[];
  readonly queue: TaskQueue;
  readonly onProgress?: ProgressListener;
};

const FS_CONCURRENCY = 32;

const BASE_BUILD_ARTIFACT_DIR_NAMES: readonly string[] = ['.next', '.svelte-kit', '.astro', '.cache', 'dist', 'build'] as const;
const BASE_PLAYWRIGHT_DIR_NAMES: readonly string[] = ['test-results', 'playwright-report'] as const;
const BASE_RUST_DIR_NAMES: readonly string[] = ['target', '.cargo-target', 'pkg'] as const;
const BASE_GO_DIR_NAMES: readonly string[] = ['dist', 'build', 'bin-win'] as const;
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

function shouldTargetDir(dirName: string, options: CliOptions): TargetDirKind | null {
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

  if (options.includeNodeModules && dirName === 'node_modules') return 'node_modules';
  if (options.includePlaywrightArtifacts && playwrightNames.has(dirName)) return 'playwright-artifact';
  if (options.includeRustArtifacts && rustNames.has(dirName)) return 'rust-artifact';

  if (options.includeBuildArtifacts && buildNames.has(dirName)) return 'build-artifact';
  if (options.includeGoArtifacts && goNames.has(dirName)) return 'go-artifact';

  if (options.profile === 'aggressive' && AGGRESSIVE_UNKNOWN_DIR_NAMES.includes(dirName)) {
    return 'unknown-artifact';
  }

  return null;
}

const PROJECT_ROOT = path.resolve(process.cwd());

function printProgress(state: DiscoveryState): void {
  if (!state.onProgress) return;
  state.onProgress({ scannedDirs: state.scannedDirs, foundTargets: state.foundTargets });
}

export async function discoverTargets(
  options: CliOptions,
  pathPolicy: { shouldPrune: (absPath: string) => boolean },
  onProgress?: ProgressListener
): Promise<DiscoveryResult> {
  const state: DiscoveryState = {
    scannedDirs: 0,
    foundTargets: 0,
    errors: [],
    queue: new TaskQueue(FS_CONCURRENCY),
    onProgress,
  };
  const targets: DiscoveredTarget[] = [];

  async function scanDir(absPath: string, depth: number): Promise<void> {
    if (path.resolve(absPath) === PROJECT_ROOT && depth > 0) return;
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
      const kind = shouldTargetDir(entry.name, options);
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
        return;
      }
      return scanDir(entryAbsPath, depth + 1);
    });

    await Promise.all(tasks);
  }

  for (const root of options.roots) {
    await scanDir(path.resolve(root), 0);
  }

  return {
    targets,
    scannedDirs: state.scannedDirs,
    errors: state.errors,
  };
}

export async function getDirSizeBytes(
  absPath: string,
  queue: TaskQueue,
  errors: string[],
): Promise<number> {
  let total = 0;
  try {
    const entries = await queue.run(() => readdir(absPath, { withFileTypes: true }));
    const tasks = entries.map(async (entry) => {
      const entryAbsPath = path.join(absPath, entry.name);
      if (entry.isDirectory()) {
        return getDirSizeBytes(entryAbsPath, queue, errors);
      }
      if (entry.isFile()) {
        const st = await queue.run(() => stat(entryAbsPath));
        return st.size;
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