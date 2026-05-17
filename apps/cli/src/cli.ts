#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import {
  discoverIdeGlobalCachesIfEnabled,
  discoverJvmGlobalCachesIfEnabled,
  discoverNpmGlobalCachesIfEnabled,
  discoverPipGlobalCachesIfEnabled,
  discoverPnpmGlobalStoreIfEnabled,
  discoverUvGlobalCachesIfEnabled,
  discoverBunGlobalCachesIfEnabled,
  discoverCargoRegistryCachesIfEnabled,
  discoverCondaPkgsCachesIfEnabled,
  discoverNugetGlobalCachesIfEnabled,
  discoverComposerGlobalCachesIfEnabled,
  discoverYarnGlobalCachesIfEnabled,
} from './ecosystem-globals.js';
import { getGoEnv } from './go-utils.js';
import { TaskQueue } from './concurrency.js';
import { dedupeDiscoveredByRealpath, discoverTargets, getDirSizeBytes, SCAN_FS_CONCURRENCY, type DiscoveredTarget } from './scan.js';
import { buildWireScanReport } from './scan-contract.js';
import { createPathPolicy } from './path-policy.js';
import { classifyTargets } from './classifier.js';
import { deleteCandidates, type DeleteExecutionResult } from './delete.js';
import { purgeQuarantine, restoreFromQuarantine } from './quarantine.js';
import type {
  CleanupCandidate,
  CleanupMode,
  CleanupProfile,
  CliOptions,
  DeleteMode,
  ProgressListener,
  ProgressPhase,
  ProgressUpdate,
  ScanReportV2,
  TargetDirKind,
} from './types.js';

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_PROFILE: CleanupProfile = 'safe';
const DEFAULT_DELETE_MODE: DeleteMode = 'quarantine';
const DEFAULT_STALE_DAYS = 45;
const DEFAULT_QUARANTINE_RETENTION_DAYS = 30;
const CLI_VERSION = '0.6.3';

export type TargetDir = CleanupCandidate;
export type ScanReport = ScanReportV2;
export {
  buildWireScanReport,
  SCAN_REPORT_SCHEMA_VERSION,
  summarizeReasonCodes,
  targetKindToWire,
} from './scan-contract.js';
export type { WireScanCandidate, WireScanReport } from './scan-contract.js';
export type { CliOptions, ProgressListener, ProgressUpdate, ProgressPhase, TargetDirKind, CleanupCandidate, CleanupProfile, DeleteMode };

type ParsedArgs = {
  readonly roots: readonly string[];
  readonly maxDepth?: number;
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
  readonly includePythonArtifacts: boolean;
  readonly includePythonVenv: boolean;
  readonly includeJvmArtifacts: boolean;
  readonly checkJvmGlobalCache: boolean;
  readonly includeDotnetArtifacts: boolean;
  readonly checkIdeGlobalCache: boolean;
  readonly checkNpmCache: boolean;
  readonly checkPnpmStore: boolean;
  readonly checkYarnCache: boolean;
  readonly checkPipCache: boolean;
  readonly checkUvCache: boolean;
  readonly checkCondaPkgsCache: boolean;
  readonly checkCargoRegistry: boolean;
  readonly checkBunCache: boolean;
  readonly checkNugetCache: boolean;
  readonly checkComposerCache: boolean;
  readonly includeReview: boolean;
  readonly json: boolean;
  readonly showBlocked: boolean;
  readonly profile?: CleanupProfile;
  readonly deleteMode?: DeleteMode;
  readonly staleDays?: number;
  readonly restoreId?: string;
  readonly purgeQuarantine: boolean;
  readonly configPath?: string;
};

function isValidProfile(value: string): value is CleanupProfile {
  return value === 'safe' || value === 'balanced' || value === 'aggressive';
}

function isValidDeleteMode(value: string): value is DeleteMode {
  return value === 'quarantine' || value === 'recycle-bin' || value === 'hard-delete';
}

function parseArgsV2(argv: readonly string[]): ParsedArgs {
  const roots: string[] = [];
  let maxDepth: number | undefined;
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
  let includePythonArtifacts = true;
  let includePythonVenv = false;
  let includeJvmArtifacts = true;
  let checkJvmGlobalCache = false;
  let includeDotnetArtifacts = true;
  let checkIdeGlobalCache = false;
  let checkNpmCache = false;
  let checkPnpmStore = false;
  let checkYarnCache = false;
  let checkPipCache = false;
  let checkUvCache = false;
  let checkCondaPkgsCache = false;
  let checkCargoRegistry = false;
  let checkBunCache = false;
  let checkNugetCache = false;
  let checkComposerCache = false;
  let includeReview = false;
  let json = false;
  let showBlocked = false;
  let profile: CleanupProfile | undefined;
  let deleteMode: DeleteMode | undefined;
  let staleDays: number | undefined;
  let restoreId: string | undefined;
  let purgeQuarantine = false;
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

    if (arg === '--max-depth') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --max-depth');
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Invalid --max-depth');
      maxDepth = parsed;
      i += 1;
      continue;
    }

    if (arg === '--profile') {
      const next = argv[i + 1];
      if (!next || !isValidProfile(next)) throw new Error('Invalid --profile. Use safe|balanced|aggressive');
      profile = next;
      i += 1;
      continue;
    }

    if (arg === '--delete-mode') {
      const next = argv[i + 1];
      if (!next || !isValidDeleteMode(next)) throw new Error('Invalid --delete-mode. Use quarantine|recycle-bin|hard-delete');
      deleteMode = next;
      i += 1;
      continue;
    }

    if (arg === '--stale-days') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --stale-days');
      const parsed = Number(next);
      if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Invalid --stale-days');
      staleDays = parsed;
      i += 1;
      continue;
    }

    if (arg === '--restore') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --restore');
      restoreId = next;
      interactive = false;
      i += 1;
      continue;
    }

    if (arg === '--config') {
      const next = argv[i + 1];
      if (!next) throw new Error('Missing value for --config');
      configPath = next;
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

    if (arg === '--check-jvm-global-cache') {
      checkJvmGlobalCache = true;
      continue;
    }

    if (arg === '--check-ide-global-cache') {
      checkIdeGlobalCache = true;
      continue;
    }

    if (arg === '--check-npm-cache') {
      checkNpmCache = true;
      continue;
    }

    if (arg === '--check-pnpm-store') {
      checkPnpmStore = true;
      continue;
    }

    if (arg === '--check-yarn-cache') {
      checkYarnCache = true;
      continue;
    }

    if (arg === '--check-pip-cache') {
      checkPipCache = true;
      continue;
    }

    if (arg === '--check-uv-cache') {
      checkUvCache = true;
      continue;
    }

    if (arg === '--check-conda-pkgs-cache') {
      checkCondaPkgsCache = true;
      continue;
    }

    if (arg === '--check-cargo-registry') {
      checkCargoRegistry = true;
      continue;
    }

    if (arg === '--check-bun-cache') {
      checkBunCache = true;
      continue;
    }

    if (arg === '--check-nuget-cache') {
      checkNugetCache = true;
      continue;
    }

    if (arg === '--check-composer-cache') {
      checkComposerCache = true;
      continue;
    }

    if (arg === '--include-python-venv') {
      includePythonVenv = true;
      continue;
    }

    if (arg === '--no-python-artifacts') {
      includePythonArtifacts = false;
      continue;
    }

    if (arg === '--no-jvm-artifacts') {
      includeJvmArtifacts = false;
      continue;
    }

    if (arg === '--no-dotnet-artifacts') {
      includeDotnetArtifacts = false;
      continue;
    }

    if (arg === '--delete') {
      mode = 'delete';
      interactive = false;
      continue;
    }

    if (arg === '--yes') {
      yes = true;
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

    if (arg === '--no-node-modules') {
      includeNodeModules = false;
      continue;
    }

    if (arg === '--no-build-artifacts') {
      includeBuildArtifacts = false;
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

    if (arg === '--include-review') {
      includeReview = true;
      continue;
    }

    if (arg === '--json') {
      json = true;
      interactive = false;
      continue;
    }

    if (arg === '--show-blocked') {
      showBlocked = true;
      continue;
    }

    if (arg === '--purge-quarantine') {
      purgeQuarantine = true;
      interactive = false;
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
    includePythonArtifacts,
    includePythonVenv,
    includeJvmArtifacts,
    checkJvmGlobalCache,
    includeDotnetArtifacts,
    checkIdeGlobalCache,
    checkNpmCache,
    checkPnpmStore,
    checkYarnCache,
    checkPipCache,
    checkUvCache,
    checkCondaPkgsCache,
    checkCargoRegistry,
    checkBunCache,
    checkNugetCache,
    checkComposerCache,
    includeReview,
    json,
    showBlocked,
    profile,
    deleteMode,
    staleDays,
    restoreId,
    purgeQuarantine,
    configPath,
  };
}

export async function mergeConfigAndArgsV2(argv: readonly string[]): Promise<CliOptions> {
  const args = parseArgsV2(argv);
  const config = await loadConfig(args.configPath);

  const roots =
    args.roots.length > 0
      ? [...args.roots]
      : config && config.roots.length > 0
        ? [...config.roots]
        : [process.cwd()];
  const maxDepth = args.maxDepth ?? config?.maxDepth ?? DEFAULT_MAX_DEPTH;
  const profile = args.profile ?? config?.profile ?? DEFAULT_PROFILE;
  const deleteMode = args.deleteMode ?? config?.deleteMode ?? DEFAULT_DELETE_MODE;
  const staleDays = args.staleDays ?? config?.staleDays ?? DEFAULT_STALE_DAYS;

  const action: CliOptions['action'] = args.restoreId
    ? 'restore'
    : args.purgeQuarantine
      ? 'purge-quarantine'
      : 'scan';

  return {
    action,
    roots,
    maxDepth,
    mode: args.mode,
    yes: args.yes,
    interactive: args.interactive,
    includeNodeModules: args.includeNodeModules && (config?.targets.nodeModules ?? true),
    includeBuildArtifacts: args.includeBuildArtifacts && (config?.targets.buildArtifacts ?? true),
    includeRustArtifacts: args.includeRustArtifacts && (config?.targets.rustArtifacts ?? true),
    includePlaywrightArtifacts: args.includePlaywrightArtifacts && (config?.targets.playwrightArtifacts ?? true),
    includeGoArtifacts: args.includeGoArtifacts && (config?.targets.goArtifacts ?? true),
    includeSize: args.includeSize,
    checkGoCache: args.checkGoCache,
    includePythonArtifacts: args.includePythonArtifacts,
    includePythonVenv: args.includePythonVenv,
    includeJvmArtifacts: args.includeJvmArtifacts,
    checkJvmGlobalCache: args.checkJvmGlobalCache,
    includeDotnetArtifacts: args.includeDotnetArtifacts,
    checkIdeGlobalCache: args.checkIdeGlobalCache,
    checkNpmCache: args.checkNpmCache,
    checkPnpmStore: args.checkPnpmStore,
    checkYarnCache: args.checkYarnCache,
    checkPipCache: args.checkPipCache,
    checkUvCache: args.checkUvCache,
    checkCondaPkgsCache: args.checkCondaPkgsCache,
    checkCargoRegistry: args.checkCargoRegistry,
    checkBunCache: args.checkBunCache,
    checkNugetCache: args.checkNugetCache,
    checkComposerCache: args.checkComposerCache,
    excludeAbsPathContains: config?.excludeAbsPathContains ?? [],
    profile,
    deleteMode,
    staleDays,
    includeReview: args.includeReview,
    json: args.json,
    showBlocked: args.showBlocked,
    restoreId: args.restoreId,
    purgeQuarantine: args.purgeQuarantine,
    quarantineRoot: config?.quarantine.root,
    quarantineRetentionDays: config?.quarantine.retentionDays ?? DEFAULT_QUARANTINE_RETENTION_DAYS,
    extraProtectedPathContains: config?.safety.extraProtectedPathContains ?? [],
    allowPathContains: config?.safety.allowPathContains ?? [],
    additionalDirNames: {
      buildArtifacts: config?.additionalDirNames.buildArtifacts ?? [],
      rustArtifacts: config?.additionalDirNames.rustArtifacts ?? [],
      goArtifacts: config?.additionalDirNames.goArtifacts ?? [],
      playwrightArtifacts: config?.additionalDirNames.playwrightArtifacts ?? [],
    },
  };
}

export function formatBytes(bytes: number): string {
  const units: readonly string[] = ['B', 'KB', 'MB', 'GB', 'TB'] as const;
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(2)} ${units[idx]}`;
}

async function discoverGoCachesIfEnabled(options: CliOptions): Promise<DiscoveredTarget[]> {
  if (!options.checkGoCache) return [];
  const discovered: DiscoveredTarget[] = [];
  const goCache = await getGoEnv('GOCACHE');
  if (goCache) {
    let mtimeMs: number | undefined;
    try {
      mtimeMs = (await stat(goCache)).mtimeMs;
    } catch {
      mtimeMs = undefined;
    }
    discovered.push({ kind: 'go-global-cache', absPath: goCache, mtimeMs });
  }
  const goModCache = await getGoEnv('GOMODCACHE');
  if (goModCache) {
    let mtimeMs: number | undefined;
    try {
      mtimeMs = (await stat(goModCache)).mtimeMs;
    } catch {
      mtimeMs = undefined;
    }
    discovered.push({ kind: 'go-global-cache', absPath: goModCache, mtimeMs });
  }
  return discovered;
}

function initializeRiskTotals() {
  return {
    safe: { count: 0, bytes: 0 },
    review: { count: 0, bytes: 0 },
    blocked: { count: 0, bytes: 0 },
  };
}

export async function buildReport(options: CliOptions, onProgress?: ProgressListener): Promise<ScanReportV2> {
  const pathPolicy = createPathPolicy({
    extraProtectedPathContains: options.extraProtectedPathContains,
    allowPathContains: options.allowPathContains,
  });

  const discovery = await discoverTargets(options, pathPolicy, onProgress);
  const extraTargets = [
    ...(await discoverGoCachesIfEnabled(options)),
    ...(await discoverJvmGlobalCachesIfEnabled(options.checkJvmGlobalCache)),
    ...(await discoverIdeGlobalCachesIfEnabled(options.checkIdeGlobalCache)),
    ...(await discoverNpmGlobalCachesIfEnabled(options.checkNpmCache)),
    ...(await discoverPnpmGlobalStoreIfEnabled(options.checkPnpmStore)),
    ...(await discoverYarnGlobalCachesIfEnabled(options.checkYarnCache)),
    ...(await discoverPipGlobalCachesIfEnabled(options.checkPipCache)),
    ...(await discoverUvGlobalCachesIfEnabled(options.checkUvCache)),
    ...(await discoverCondaPkgsCachesIfEnabled(options.checkCondaPkgsCache)),
    ...(await discoverCargoRegistryCachesIfEnabled(options.checkCargoRegistry)),
    ...(await discoverBunGlobalCachesIfEnabled(options.checkBunCache)),
    ...(await discoverNugetGlobalCachesIfEnabled(options.checkNugetCache)),
    ...(await discoverComposerGlobalCachesIfEnabled(options.checkComposerCache)),
  ];
  const errors = [...discovery.errors];
  if (options.checkCondaPkgsCache) {
    errors.push(
      'Conda envs/ directories are never targeted; only package caches (pkgs) with markers.'
    );
  }
  if (discovery.skippedSymlinkDirTraversal > 0) {
    errors.push(
      `Note: Did not traverse ${discovery.skippedSymlinkDirTraversal} symbolic link director(ies) (avoids cycles and out-of-root escapes). Targets placed directly on those links are still listed. See docs/milestones/milestone-1.md.`
    );
  }

  let discovered = [...discovery.targets, ...extraTargets];
  discovered = await dedupeDiscoveredByRealpath(discovered, errors);

  onProgress?.({
    phase: 'classify',
    scannedDirs: discovery.scannedDirs,
    foundTargets: discovered.length,
  });

  const classified = await classifyTargets(discovered, options, pathPolicy);
  const visibleCandidates = options.showBlocked ? classified : classified.filter((candidate) => candidate.risk !== 'blocked');

  const queue = new TaskQueue(SCAN_FS_CONCURRENCY);

  if (options.includeSize) {
    onProgress?.({
      phase: 'size',
      scannedDirs: discovery.scannedDirs,
      foundTargets: visibleCandidates.length,
      sizedCandidates: 0,
    });
    const SIZE_TIMEOUT_MS = 30000;
    await Promise.all(
      visibleCandidates.map(async (candidate) => {
        const timeoutPromise = new Promise<number>((_, reject) => {
          const timer = setTimeout(() => reject(new Error('TIMEOUT')), SIZE_TIMEOUT_MS);
          timer.unref();
        });
        try {
          const size = await Promise.race([getDirSizeBytes(candidate.absPath, queue, errors), timeoutPromise]);
          (candidate as { size?: number }).size = size;
        } catch (error: unknown) {
          if (error instanceof Error && error.message === 'TIMEOUT') {
            errors.push(`Size calculation timed out: ${candidate.absPath}`);
          } else {
            errors.push(`Size calculation failed: ${candidate.absPath}`);
          }
        }
      })
    );
    onProgress?.({
      phase: 'size',
      scannedDirs: discovery.scannedDirs,
      foundTargets: visibleCandidates.length,
      sizedCandidates: visibleCandidates.length,
    });
  }

  const totalsByRisk = initializeRiskTotals();
  const totalsByKind: Record<string, { count: number; bytes: number }> = {};

  let totalBytes = 0;
  for (const candidate of visibleCandidates) {
    const size = candidate.size ?? 0;
    totalsByRisk[candidate.risk].count += 1;
    totalsByRisk[candidate.risk].bytes += size;

    if (!totalsByKind[candidate.kind]) {
      totalsByKind[candidate.kind] = { count: 0, bytes: 0 };
    }
    totalsByKind[candidate.kind].count += 1;
    totalsByKind[candidate.kind].bytes += size;

    totalBytes += size;
  }

  return {
    candidates: visibleCandidates,
    totalsByRisk,
    totalsByKind,
    totalBytes,
    errors,
    scannedDirs: discovery.scannedDirs,
  };
}

export async function executeDeletion(
  targets: readonly CleanupCandidate[],
  options: CliOptions,
  onProgress?: (done: number) => void
): Promise<DeleteExecutionResult> {
  return deleteCandidates(targets, { deleteMode: options.deleteMode, quarantineRoot: options.quarantineRoot }, onProgress);
}

export async function deleteTargets(
  targets: readonly TargetDir[],
  onProgress?: (done: number) => void
): Promise<string[]> {
  const result = await deleteCandidates(targets, { deleteMode: 'hard-delete' }, onProgress);
  return [...result.errors];
}

function getUsageText(): string {
  return [
    'deco (interactive by default in TTY)',
    '',
    'Usage:',
    '  deco --root "E:/" --max-depth 6',
    '  deco --root "E:/Projects" --delete --yes',
    '  deco --profile safe --delete-mode quarantine',
    '  deco --restore <id>',
    '  deco --purge-quarantine --yes',
    '  deco --help',
    '  deco --version',
    '',
    'Options:',
    '  --root <path>               Root folder to scan (repeatable). Default: cwd',
    '  --config <path>             Explicit config path',
    '  --max-depth <n>             Max scan depth. Default: 6',
    '  --profile <mode>            safe|balanced|aggressive (default: safe)',
    '  --delete-mode <mode>        quarantine|recycle-bin|hard-delete (default: quarantine)',
    '  --stale-days <n>            Node_modules stale threshold in days (default: 45)',
    '  --include-review            Allow deleting review-risk targets (never blocked)',
    '  --json                      Scan report as versioned JSON (scan contract; see docs/schemas/scan-report.schema.json)',
    '  --show-blocked              Include blocked targets in report output',
    '  --restore <id>              Restore a quarantined target by id',
    '  --purge-quarantine          Purge expired quarantine entries (requires --yes)',
    '  --no-size                   Skip size calculation (much faster)',
    '  --interactive               Force interactive mode (default in TTY)',
    '  --dry-run                   Disable interactive mode and show report',
    '  --delete                    Actually delete targets (requires --yes)',
    '  --yes                       Confirm deletion',
    '  --check-go-cache            Include global Go caches (GOCACHE, GOMODCACHE)',
    '  --check-jvm-global-cache    Include ~/.m2/repository and ~/.gradle/caches',
    '  --check-ide-global-cache    Include Xcode DerivedData (macOS / Windows path)',
    '  --check-npm-cache           Include npm cache dir (_cacache marker; review tier)',
    '  --check-pnpm-store          Include pnpm content store (v3 marker; review tier)',
    '  --check-yarn-cache          Include Yarn cache (v6 or Berry cache marker; review tier)',
    '  --check-pip-cache           Include pip cache (wheels/http marker; review tier)',
    '  --check-uv-cache            Include uv cache (archive/downloads marker; review tier)',
    '  --check-conda-pkgs-cache    Include Conda pkgs cache (urls.txt/cache marker; never envs/)',
    '  --check-cargo-registry      Include Cargo registry cache (CARGO_HOME/registry; review tier)',
    '  --check-bun-cache           Include bun install global cache (review tier)',
    '  --check-nuget-cache         Include NuGet global packages folder (review tier)',
    '  --check-composer-cache      Include Composer global cache (review tier)',
    '  --include-python-venv       Include venv/.venv (review tier; opt-in)',
    '  --no-python-artifacts       Skip Python caches/build dirs when pyproject present',
    '  --no-jvm-artifacts          Skip JVM build/ when Gradle/Maven markers present',
    '  --no-dotnet-artifacts       Skip bin/obj when .csproj/.sln present',
    '  --no-node-modules           Skip node_modules',
    '  --no-build-artifacts        Skip dist/build/dist-firefox/.next/etc',
    '  --no-rust-artifacts         Skip target/.cargo-target/pkg',
    '  --no-playwright-artifacts   Skip test-results/playwright-report',
    '  --no-go-artifacts           Skip bin/dist/build in Go projects',
    '  -h, --help                  Show usage information',
    '  -v, --version               Show CLI version',
  ].join('\n');
}

function printHumanReport(options: CliOptions, report: ScanReportV2): void {
  process.stdout.write(`Mode: ${options.mode}\n`);
  process.stdout.write(`Profile: ${options.profile}\n`);
  process.stdout.write(`Delete mode: ${options.deleteMode}\n`);
  process.stdout.write(`Roots:\n`);
  for (const root of options.roots) process.stdout.write(`- ${path.resolve(root)}\n`);
  process.stdout.write(`Candidates found: ${report.candidates.length}\n`);
  process.stdout.write(`Estimated reclaimable: ${formatBytes(report.totalBytes)}\n`);
  process.stdout.write(`Directories scanned: ${report.scannedDirs}\n\n`);

  process.stdout.write('By Risk:\n');
  for (const risk of ['safe', 'review', 'blocked'] as const) {
    const totals = report.totalsByRisk[risk];
    process.stdout.write(`- ${risk}: ${totals.count} (${formatBytes(totals.bytes)})\n`);
  }
  process.stdout.write('\nBy Kind:\n');
  for (const [kind, totals] of Object.entries(report.totalsByKind)) {
    process.stdout.write(`- ${kind}: ${totals.count} (${formatBytes(totals.bytes)})\n`);
  }

  process.stdout.write('\nSample Candidates:\n');
  for (const candidate of report.candidates.slice(0, 50)) {
    const reasons = candidate.reasonCodes.join(',');
    process.stdout.write(`- [${candidate.risk}] ${candidate.kind} ${candidate.absPath} (${reasons})\n`);
  }
  if (report.candidates.length > 50) {
    process.stdout.write(`... ${report.candidates.length - 50} more\n`);
  }

  if (report.errors.length > 0) {
    process.stdout.write(`\nWarnings (${report.errors.length}):\n`);
    for (const err of report.errors.slice(0, 10)) process.stdout.write(`  ! ${err}\n`);
    if (report.errors.length > 10) process.stdout.write(`  ... and ${report.errors.length - 10} more\n`);
  }
}

function getDeletableCandidates(
  candidates: readonly CleanupCandidate[],
  includeReview: boolean,
  options: Pick<
    CliOptions,
    | 'checkGoCache'
    | 'checkJvmGlobalCache'
    | 'checkIdeGlobalCache'
    | 'checkNpmCache'
    | 'checkPnpmStore'
    | 'checkYarnCache'
    | 'checkPipCache'
    | 'checkUvCache'
    | 'checkCondaPkgsCache'
    | 'checkCargoRegistry'
    | 'checkBunCache'
    | 'checkNugetCache'
    | 'checkComposerCache'
    | 'includePythonVenv'
  >
): CleanupCandidate[] {
  return candidates.filter((candidate) => {
    if (candidate.risk === 'blocked') return false;
    if (candidate.kind === 'go-global-cache' && !options.checkGoCache) return false;
    if (candidate.kind === 'jvm-global-cache' && !options.checkJvmGlobalCache) return false;
    if (candidate.kind === 'ide-global-cache' && !options.checkIdeGlobalCache) return false;
    if (candidate.kind === 'npm-global-cache' && !options.checkNpmCache) return false;
    if (candidate.kind === 'pnpm-global-store' && !options.checkPnpmStore) return false;
    if (candidate.kind === 'yarn-global-cache' && !options.checkYarnCache) return false;
    if (candidate.kind === 'pip-global-cache' && !options.checkPipCache) return false;
    if (candidate.kind === 'uv-global-cache' && !options.checkUvCache) return false;
    if (candidate.kind === 'conda-pkgs-cache' && !options.checkCondaPkgsCache) return false;
    if (candidate.kind === 'cargo-registry-cache' && !options.checkCargoRegistry) return false;
    if (candidate.kind === 'bun-global-cache' && !options.checkBunCache) return false;
    if (candidate.kind === 'nuget-global-cache' && !options.checkNugetCache) return false;
    if (candidate.kind === 'composer-global-cache' && !options.checkComposerCache) return false;
    if (candidate.kind === 'python-venv' && !options.includePythonVenv) return false;
    if (candidate.risk === 'review') return includeReview;
    return true;
  });
}

import { runInteractive } from './ui.js';

async function main(): Promise<void> {
  try {
    const argv = process.argv.slice(2);
    if (argv.includes('--help') || argv.includes('-h')) {
      process.stdout.write(`${getUsageText()}\n`);
      return;
    }
    if (argv.includes('--version') || argv.includes('-v')) {
      process.stdout.write(`${CLI_VERSION}\n`);
      return;
    }

    const options = await mergeConfigAndArgsV2(argv);

    if (options.action === 'restore') {
      if (!options.restoreId) throw new Error('Missing restore id. Use --restore <id>');
      const restored = await restoreFromQuarantine(options.restoreId, options.roots, options.quarantineRoot);
      process.stdout.write(`Restored: ${restored}\n`);
      return;
    }

    if (options.action === 'purge-quarantine') {
      if (!options.yes) throw new Error('Refusing to purge quarantine without --yes');
      const result = await purgeQuarantine(options.roots, options.quarantineRetentionDays, options.quarantineRoot);
      process.stdout.write(`Purged ${result.purged} quarantined targets.\n`);
      if (result.errors.length > 0) {
        process.stdout.write(`Warnings (${result.errors.length}):\n`);
        for (const err of result.errors) process.stdout.write(`  ! ${err}\n`);
      }
      return;
    }

    if (options.interactive && process.stdout.isTTY && !options.json) {
      await runInteractive(options);
      return;
    }

    if (options.mode === 'delete' && !options.yes) {
      throw new Error('Refusing to delete without --yes');
    }

    const report = await buildReport(options);

    if (options.json) {
      const wire = buildWireScanReport({
        report,
        scanId: randomUUID(),
        roots: options.roots,
        profile: options.profile,
        maxDepth: options.maxDepth,
        staleDays: options.staleDays,
        includeSize: options.includeSize,
        showBlocked: options.showBlocked,
        checkGoCache: options.checkGoCache,
      });
      process.stdout.write(`${JSON.stringify(wire, null, 2)}\n`);
    } else {
      printHumanReport(options, report);
    }

    if (options.mode === 'delete') {
      if (!options.includeReview && report.totalsByRisk.review.count > 0) {
        process.stdout.write('Review-risk targets were skipped. Pass --include-review to include them.\n');
      }
      const targetsToDelete = getDeletableCandidates(report.candidates, options.includeReview, options);
      process.stdout.write(`Deleting ${targetsToDelete.length} candidates using ${options.deleteMode} mode...\n`);
      const result = await executeDeletion(targetsToDelete, options);

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) process.stdout.write(`! ${warning}\n`);
      }

      if (result.quarantined.length > 0) {
        process.stdout.write(`Quarantined ${result.quarantined.length} targets.\n`);
        for (const entry of result.quarantined.slice(0, 10)) {
          process.stdout.write(`- ${entry.id} -> ${entry.originalPath}\n`);
        }
        if (result.quarantined.length > 10) {
          process.stdout.write(`... ${result.quarantined.length - 10} more\n`);
        }
      }

      if (result.errors.length > 0) {
        process.stdout.write(`Deletion finished with ${result.errors.length} errors.\n`);
        for (const err of result.errors.slice(0, 20)) process.stdout.write(`! ${err}\n`);
        process.exitCode = 1;
      } else {
        process.stdout.write('Deletion completed successfully.\n');
      }
    } else if (!options.json) {
      process.stdout.write('Dry-run complete. Re-run with --delete --yes to remove safe targets.\n');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n\n`);
    process.stdout.write(`${getUsageText()}\n`);
    process.exitCode = 1;
  }
}

const isMainModule = (() => {
  try {
    return path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMainModule) {
  void main();
}
