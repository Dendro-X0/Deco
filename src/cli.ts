#!/usr/bin/env node

import { stat, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import readline from 'node:readline';
import { loadConfig } from './config.js';
import { getGoEnv } from './go-utils.js';
import { TaskQueue } from './concurrency.js';

type ByteCount = number;

export type CleanupMode = 'dry-run' | 'delete';

export type CliOptions = {
  readonly roots: readonly string[];
  readonly maxDepth: number;
  readonly mode: CleanupMode;
  readonly yes: boolean;
  readonly interactive: boolean;
  readonly includeNodeModules: boolean;
  readonly includeBuildArtifacts: boolean;
  readonly includeRustArtifacts: boolean;
  readonly includePlaywrightArtifacts: boolean;
  readonly includeGoArtifacts: boolean;
  readonly includeSize: boolean;
  readonly checkGoCache: boolean;
  readonly excludeAbsPathContains: readonly string[];
  readonly silent?: boolean;
};

export type TargetDirKind =
  | 'node_modules'
  | 'build-artifact'
  | 'rust-artifact'
  | 'go-artifact'
  | 'go-global-cache'
  | 'playwright-artifact';

export type TargetDir = {
  readonly kind: TargetDirKind;
  readonly absPath: string;
  size?: ByteCount;
};

export type ScanReport = {
  readonly targets: readonly TargetDir[];
  readonly totalBytes: ByteCount;
  readonly errors: readonly string[];
  readonly scannedDirs: number;
};

type ScanState = {
  scannedDirs: number;
  foundTargets: number;
  readonly errors: string[];
  readonly queue: TaskQueue;
  readonly silent?: boolean;
  readonly onProgress?: ProgressListener;
};

const DEFAULT_MAX_DEPTH: number = 6;
const FS_CONCURRENCY = 32;

const BUILD_ARTIFACT_DIR_NAMES: readonly string[] = [
  '.next',
  '.svelte-kit',
  '.astro',
  '.cache',
] as const;

const PLAYWRIGHT_DIR_NAMES: readonly string[] = ['test-results', 'playwright-report'] as const;

const RUST_DIR_NAMES: readonly string[] = ['target', '.cargo-target', 'pkg'] as const;

const GO_DIR_NAMES: readonly string[] = ['dist', 'build', 'bin-win'] as const;

const SAFE_EXCLUDE_PATTERNS: readonly string[] = [
  'resources' + path.sep + 'app',
  'Program Files',
  'Program Files (x86)',
  'AppData',
  '.vscode',
  '.vscode-insiders',
  '.cursor',
  'Windows',
  'System32',
  '$Recycle.Bin',
  'System Volume Information',
  'Config.Msi',
] as const;

function parseArgs(argv: readonly string[]): CliOptions {
  const roots: string[] = [];
  let maxDepth = DEFAULT_MAX_DEPTH;
  let mode: CleanupMode = 'dry-run';
  let yes = false;
  let interactive = true;
  let includeNodeModules = true;
  let includeBuildArtifacts = true;
  let includeRustArtifacts = true;
  let includePlaywrightArtifacts = true;
  let includeGoArtifacts = true;
  let includeSize = true;
  let checkGoCache = false;
  let configPath: string | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --root');
      roots.push(next);
      i += 1;
      continue;
    }
    if (arg === '--no-size') {
      includeSize = false;
      continue;
    }
    if (arg === '--check-go-cache') {
      checkGoCache = true;
      continue;
    }
    if (arg === '--config') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --config');
      configPath = next;
      i += 1;
      continue;
    }
    if (arg === '--max-depth') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --max-depth');
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Invalid --max-depth');
      maxDepth = parsed;
      i += 1;
      continue;
    }
    if (arg === '--delete') {
      mode = 'delete';
      continue;
    }
    if (arg === '--yes') {
      yes = true;
      continue;
    }
    if (arg === '--no-node-modules') {
      includeNodeModules = false;
      continue;
    }
    if (arg === '--no-build-artifacts') {
      includeBuildArtifacts = false;
      continue;
    }
    if (arg === '--dry-run') {
      mode = 'dry-run';
      interactive = false;
      continue;
    }
    if (arg === '--interactive') {
      interactive = true;
      continue;
    }
    if (arg === '--no-rust-artifacts') {
      includeRustArtifacts = false;
      continue;
    }
    if (arg === '--no-playwright-artifacts') {
      includePlaywrightArtifacts = false;
      continue;
    }
    if (arg === '--no-go-artifacts') {
      includeGoArtifacts = false;
      continue;
    }
    if (arg === '--delete') {
      mode = 'delete';
      interactive = false; // --delete implies non-interactive if used with --yes
      continue;
    }
    if (arg === '--yes') {
      yes = true;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return {
    roots,
    maxDepth,
    mode,
    yes,
    interactive,
    includeNodeModules,
    includeBuildArtifacts,
    includeRustArtifacts,
    includePlaywrightArtifacts,
    includeGoArtifacts,
    includeSize,
    checkGoCache,
    excludeAbsPathContains: [],
  };
}

async function mergeConfigAndArgs(argv: readonly string[]): Promise<CliOptions> {
  const args = parseArgs(argv);
  // Find if --config was passed (we need it here too, or we can refactor parseArgs)
  // For now, let's just re-parse or extract.
  let explicitConfigPath: string | undefined;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--config') explicitConfigPath = argv[i + 1];
  }
  const config = await loadConfig(explicitConfigPath);
  if (!config) {
    return { ...args, roots: args.roots.length > 0 ? args.roots : [process.cwd()] };
  }
  const finalRoots = args.roots.length > 0 ? args.roots : config.roots;
  return {
    roots: finalRoots,
    maxDepth: args.maxDepth !== DEFAULT_MAX_DEPTH ? args.maxDepth : config.maxDepth,
    mode: args.mode,
    yes: args.yes,
    interactive: args.interactive,
    includeNodeModules: args.includeNodeModules && (config.targets.nodeModules ?? true),
    includeBuildArtifacts: args.includeBuildArtifacts && (config.targets.buildArtifacts ?? true),
    includeRustArtifacts: args.includeRustArtifacts && (config.targets.rustArtifacts ?? true),
    includePlaywrightArtifacts: args.includePlaywrightArtifacts && (config.targets.playwrightArtifacts ?? true),
    includeGoArtifacts: args.includeGoArtifacts && (config.targets.goArtifacts ?? true),
    includeSize: args.includeSize,
    checkGoCache: args.checkGoCache,
    excludeAbsPathContains: config.excludeAbsPathContains ?? [],
  };
}

function shouldTargetDir(dirName: string, options: CliOptions): TargetDirKind | null {
  if (options.includeNodeModules && dirName === 'node_modules') return 'node_modules';
  if (options.includePlaywrightArtifacts && PLAYWRIGHT_DIR_NAMES.includes(dirName)) return 'playwright-artifact';
  if (options.includeRustArtifacts && RUST_DIR_NAMES.includes(dirName)) return 'rust-artifact';

  // For dist/build, we check if it's likely a project artifact (dist/build)
  if (options.includeBuildArtifacts && BUILD_ARTIFACT_DIR_NAMES.includes(dirName)) return 'build-artifact';

  if (dirName === 'dist' || dirName === 'build') {
    if (options.includeBuildArtifacts) return 'build-artifact';
    if (options.includeGoArtifacts) return 'go-artifact';
  }

  return null;
}

async function getDirSizeBytes(absPath: string, state: ScanState): Promise<ByteCount> {
  let total: ByteCount = 0;
  try {
    const entries: import('node:fs').Dirent[] = await state.queue.run(() => readdir(absPath, { withFileTypes: true }));
    const tasks = entries.map(async (entry) => {
      const entryAbsPath = path.join(absPath, entry.name);
      if (entry.isDirectory()) {
        return getDirSizeBytes(entryAbsPath, state);
      }
      if (entry.isFile()) {
        const st: import('node:fs').Stats = await state.queue.run(() => stat(entryAbsPath));
        return st.size;
      }
      return 0;
    });
    const results = await Promise.all(tasks);
    total = results.reduce((a: number, b: number) => a + b, 0);
  } catch (error: unknown) {
    state.errors.push(`Size error: ${absPath} (${(error as { code?: string }).code ?? 'unknown'})`);
  }
  return total;
}

function printProgress(state: ScanState): void {
  if (state.onProgress) {
    state.onProgress({ scannedDirs: state.scannedDirs, foundTargets: state.foundTargets });
    return;
  }
  if (state.silent || !process.stdout.isTTY) return;
  readline.cursorTo(process.stdout, 0);
  process.stdout.write(`Scanning... ${state.scannedDirs} dirs visited | ${state.foundTargets} targets found`);
}

async function scanDir(absPath: string, depth: number, options: CliOptions, state: ScanState, acc: TargetDir[]): Promise<void> {
  if (depth > options.maxDepth) return;
  const absPathLower = absPath.toLowerCase();
  for (const pattern of SAFE_EXCLUDE_PATTERNS) {
    if (absPathLower.includes(pattern.toLowerCase())) return;
  }
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
    const kind = shouldTargetDir(entry.name, options);
    const entryAbsPath = path.join(absPath, entry.name);
    if (kind) {
      state.foundTargets += 1;
      acc.push({ kind, absPath: entryAbsPath });
      printProgress(state);
      return;
    }
    return scanDir(entryAbsPath, depth + 1, options, state, acc);
  });
  await Promise.all(tasks);
}

export function formatBytes(bytes: ByteCount): string {
  const units: readonly string[] = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(2)} ${units[idx]}`;
}

export type ProgressUpdate = {
  scannedDirs: number;
  foundTargets: number;
};

export type ProgressListener = (update: ProgressUpdate) => void;

export async function buildReport(options: CliOptions, onProgress?: ProgressListener): Promise<ScanReport> {
  const targets: TargetDir[] = [];
  const state: ScanState = {
    scannedDirs: 0,
    foundTargets: 0,
    errors: [],
    queue: new TaskQueue(FS_CONCURRENCY),
    silent: options.silent,
    onProgress,
  };
  for (const root of options.roots) {
    const absRoot = path.resolve(root);
    await scanDir(absRoot, 0, options, state, targets);
  }
  if (options.checkGoCache) {
    const goCache = await getGoEnv('GOCACHE');
    if (goCache) targets.push({ kind: 'go-global-cache', absPath: goCache });
    const goModCache = await getGoEnv('GOMODCACHE');
    if (goModCache) targets.push({ kind: 'go-global-cache', absPath: goModCache });
  }
  if (process.stdout.isTTY && !options.silent) process.stdout.write('\n');
  let totalBytes = 0;
  if (options.includeSize) {
    const SIZE_TIMEOUT_MS = 30000;
    const results = await Promise.all(targets.map(async (t) => {
      const timeoutPromise = new Promise<number>((_, reject) => {
        const timer = setTimeout(() => reject(new Error('TIMEOUT')), SIZE_TIMEOUT_MS);
        timer.unref(); // Don't block process exit
      });
      try {
        const size = await Promise.race([getDirSizeBytes(t.absPath, state), timeoutPromise]);
        (t as { size?: number }).size = size;
        return size;
      } catch (err: unknown) {
        if (err instanceof Error && err.message === 'TIMEOUT') {
          state.errors.push(`Size calculation timed out: ${t.absPath}`);
          return 0;
        }
        throw err;
      }
    }));
    totalBytes = results.reduce((a: number, b: number) => a + b, 0);
  }
  return { targets, totalBytes, errors: state.errors, scannedDirs: state.scannedDirs };
}

export async function deleteTargets(
  targets: readonly TargetDir[],
  onProgress?: (done: number) => void
): Promise<string[]> {
  const queue = new TaskQueue(FS_CONCURRENCY);
  let done = 0;
  const errors: string[] = [];

  const tasks = targets.map(async (target) => {
    try {
      await queue.run(() => rm(target.absPath, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 }));
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? 'unknown';
      errors.push(`Failed to delete ${target.absPath} (${code})`);
    } finally {
      done += 1;
      onProgress?.(done);
    }
  });

  await Promise.all(tasks);
  return errors;
}



function getUsageText(): string {
  return [
    'deco (interactive by default in TTY)',
    '',
    'Usage:',
    '  deco --root "E:/" --max-depth 6',
    '  deco --root "E:/Projects" --delete --yes',
    '  deco --dry-run             Show report without interative TUI',
    '',
    'Options:',
    '  --root <path>              Root folder to scan (repeatable). Default: cwd',
    '  --config <path>            Explicit config path',
    '  --max-depth <n>            Max scan depth. Default: 6',
    '  --no-size                  Skip size calculation (much faster)',
    '  --interactive              Force interactive mode (default in TTY)',
    '  --dry-run                  Disable interactive mode and show report',
    '  --delete                   Actually delete targets (requires --yes)',
    '  --yes                      Confirm deletion',
    '  --check-go-cache           Include global Go caches (GOCACHE, GOMODCACHE)',
    '  --no-node-modules          Skip node_modules',
    '  --no-build-artifacts       Skip dist/build/.next/etc',
    '  --no-rust-artifacts        Skip target/.cargo-target/pkg',
    '  --no-playwright-artifacts  Skip test-results/playwright-report',
    '  --no-go-artifacts          Skip bin/dist/build in Go projects',
  ].join('\n');
}

import { runInteractive } from './ui.js';

async function main(): Promise<void> {
  try {
    const options = await mergeConfigAndArgs(process.argv.slice(2));

    if (options.interactive && process.stdout.isTTY) {
      await runInteractive(options);
      return;
    }

    if (options.mode === 'delete' && !options.yes) {
      throw new Error('Refusing to delete without --yes');
    }

    const report = await buildReport(options);

    process.stdout.write(`Mode: ${options.mode}\n`);
    process.stdout.write(`Roots:\n`);
    for (const root of options.roots) process.stdout.write(`- ${path.resolve(root)}\n`);
    process.stdout.write(`Targets found: ${report.targets.length}\n`);
    process.stdout.write(`Estimated reclaimable: ${formatBytes(report.totalBytes)}\n`);
    process.stdout.write(`Directories scanned: ${report.scannedDirs}\n\n`);
    const grouped: Record<TargetDirKind, TargetDir[]> = {
      'node_modules': [],
      'build-artifact': [],
      'rust-artifact': [],
      'go-artifact': [],
      'go-global-cache': [],
      'playwright-artifact': [],
    };
    for (const target of report.targets) grouped[target.kind].push(target);
    for (const kind of Object.keys(grouped) as TargetDirKind[]) {
      const items = grouped[kind];
      process.stdout.write(`${kind}: ${items.length}\n`);
      for (const item of items.slice(0, 50)) process.stdout.write(`  - ${item.absPath}\n`);
      if (items.length > 50) process.stdout.write(`  ... ${items.length - 50} more\n`);
      process.stdout.write('\n');
    }
    if (report.errors.length > 0) {
      process.stdout.write(`Warnings (${report.errors.length}):\n`);
      for (const err of report.errors.slice(0, 10)) process.stdout.write(`  ! ${err}\n`);
      if (report.errors.length > 10) process.stdout.write(`  ... and ${report.errors.length - 10} more\n`);
      process.stdout.write('\n');
    }
    if (options.mode === 'delete') {
      process.stdout.write('Deleting...\n');
      await deleteTargets(report.targets);
      process.stdout.write('Done.\n');
    } else {
      process.stdout.write('Dry-run complete. Re-run with --interactive, or --delete --yes to remove targets.\n');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n\n`);
    process.stdout.write(`${getUsageText()}\n`);
    process.exitCode = 1;
  }
}

void main();
