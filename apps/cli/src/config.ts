import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { CleanupProfile, DeleteMode } from './types.js';

export type DiskCleanupConfig = {
  readonly roots?: readonly string[];
  readonly maxDepth?: number;
  readonly targets?: {
    readonly nodeModules?: boolean;
    readonly buildArtifacts?: boolean;
    readonly rustArtifacts?: boolean;
    readonly goArtifacts?: boolean;
    readonly playwrightArtifacts?: boolean;
  };
  readonly additionalDirNames?: {
    readonly buildArtifacts?: readonly string[];
    readonly rustArtifacts?: readonly string[];
    readonly goArtifacts?: readonly string[];
    readonly playwrightArtifacts?: readonly string[];
  };
  readonly excludeAbsPathContains?: readonly string[];
  readonly profile?: CleanupProfile;
  readonly deleteMode?: DeleteMode;
  readonly staleDays?: number;
  readonly quarantine?: {
    readonly root?: string;
    readonly retentionDays?: number;
  };
  readonly safety?: {
    readonly extraProtectedPathContains?: readonly string[];
    readonly allowPathContains?: readonly string[];
  };
};

type NormalizedDiskCleanupConfig = {
  readonly roots: readonly string[];
  readonly maxDepth: number;
  readonly targets: {
    readonly nodeModules: boolean;
    readonly buildArtifacts: boolean;
    readonly rustArtifacts: boolean;
    readonly goArtifacts: boolean;
    readonly playwrightArtifacts: boolean;
  };
  readonly additionalDirNames: {
    readonly buildArtifacts: readonly string[];
    readonly rustArtifacts: readonly string[];
    readonly goArtifacts: readonly string[];
    readonly playwrightArtifacts: readonly string[];
  };
  readonly excludeAbsPathContains: readonly string[];
  readonly profile?: CleanupProfile;
  readonly deleteMode?: DeleteMode;
  readonly staleDays?: number;
  readonly quarantine: {
    readonly root?: string;
    readonly retentionDays?: number;
  };
  readonly safety: {
    readonly extraProtectedPathContains: readonly string[];
    readonly allowPathContains: readonly string[];
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertOnlyKeys(obj: Record<string, unknown>, allowed: readonly string[], context: string): void {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) {
      throw new Error(`Unknown key ${context}.${key}`);
    }
  }
}

function assertStringArray(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`${field} must be string[]`);
  }
  return value;
}

function validateConfig(data: unknown): DiskCleanupConfig {
  if (!isRecord(data)) throw new Error('Config must be an object');

  assertOnlyKeys(
    data,
    [
      'roots',
      'maxDepth',
      'targets',
      'additionalDirNames',
      'excludeAbsPathContains',
      'profile',
      'deleteMode',
      'staleDays',
      'quarantine',
      'safety',
    ],
    'config'
  );

  if (typeof data.roots !== 'undefined') {
    if (!Array.isArray(data.roots) || data.roots.some((r) => typeof r !== 'string')) {
      throw new Error('config.roots must be string[] when provided');
    }
  }

  if (typeof data.maxDepth !== 'undefined') {
    if (typeof data.maxDepth !== 'number' || !Number.isFinite(data.maxDepth) || data.maxDepth < 0) {
      throw new Error('config.maxDepth must be a non-negative number when provided');
    }
  }

  if (typeof data.targets !== 'undefined') {
    if (!isRecord(data.targets)) throw new Error('config.targets must be an object');
    assertOnlyKeys(data.targets, ['nodeModules', 'buildArtifacts', 'rustArtifacts', 'goArtifacts', 'playwrightArtifacts'], 'config.targets');

    for (const key of ['nodeModules', 'buildArtifacts', 'rustArtifacts', 'goArtifacts', 'playwrightArtifacts'] as const) {
      const value = data.targets[key];
      if (typeof value !== 'undefined' && typeof value !== 'boolean') {
        throw new Error(`config.targets.${key} must be boolean`);
      }
    }
  }

  if (typeof data.additionalDirNames !== 'undefined') {
    if (!isRecord(data.additionalDirNames)) throw new Error('config.additionalDirNames must be an object');
    assertOnlyKeys(data.additionalDirNames, ['buildArtifacts', 'rustArtifacts', 'goArtifacts', 'playwrightArtifacts'], 'config.additionalDirNames');

    for (const key of ['buildArtifacts', 'rustArtifacts', 'goArtifacts', 'playwrightArtifacts'] as const) {
      const value = data.additionalDirNames[key];
      if (typeof value !== 'undefined') {
        assertStringArray(value, `config.additionalDirNames.${key}`);
      }
    }
  }

  if (typeof data.excludeAbsPathContains !== 'undefined') {
    assertStringArray(data.excludeAbsPathContains, 'config.excludeAbsPathContains');
  }

  if (typeof data.profile !== 'undefined' && data.profile !== 'safe' && data.profile !== 'balanced' && data.profile !== 'aggressive') {
    throw new Error('config.profile must be one of safe|balanced|aggressive');
  }

  if (
    typeof data.deleteMode !== 'undefined' &&
    data.deleteMode !== 'quarantine' &&
    data.deleteMode !== 'recycle-bin' &&
    data.deleteMode !== 'hard-delete'
  ) {
    throw new Error('config.deleteMode must be one of quarantine|recycle-bin|hard-delete');
  }

  if (typeof data.staleDays !== 'undefined' && (typeof data.staleDays !== 'number' || !Number.isFinite(data.staleDays) || data.staleDays < 0)) {
    throw new Error('config.staleDays must be a non-negative number');
  }

  if (typeof data.quarantine !== 'undefined') {
    if (!isRecord(data.quarantine)) throw new Error('config.quarantine must be an object');
    assertOnlyKeys(data.quarantine, ['root', 'retentionDays'], 'config.quarantine');
    if (typeof data.quarantine.root !== 'undefined' && typeof data.quarantine.root !== 'string') {
      throw new Error('config.quarantine.root must be a string');
    }
    if (
      typeof data.quarantine.retentionDays !== 'undefined' &&
      (typeof data.quarantine.retentionDays !== 'number' || !Number.isFinite(data.quarantine.retentionDays) || data.quarantine.retentionDays < 0)
    ) {
      throw new Error('config.quarantine.retentionDays must be a non-negative number');
    }
  }

  if (typeof data.safety !== 'undefined') {
    if (!isRecord(data.safety)) throw new Error('config.safety must be an object');
    assertOnlyKeys(data.safety, ['extraProtectedPathContains', 'allowPathContains'], 'config.safety');

    if (typeof data.safety.extraProtectedPathContains !== 'undefined') {
      assertStringArray(data.safety.extraProtectedPathContains, 'config.safety.extraProtectedPathContains');
    }

    if (typeof data.safety.allowPathContains !== 'undefined') {
      assertStringArray(data.safety.allowPathContains, 'config.safety.allowPathContains');
    }
  }

  return data as DiskCleanupConfig;
}

const DEFAULT_TARGETS = {
  nodeModules: true,
  buildArtifacts: true,
  rustArtifacts: true,
  goArtifacts: true,
  playwrightArtifacts: true,
} as const;

export function normalizeConfig(config: DiskCleanupConfig): NormalizedDiskCleanupConfig {
  const targets = { ...DEFAULT_TARGETS, ...(config.targets ?? {}) };
  return {
    roots: config.roots ?? [],
    maxDepth: config.maxDepth ?? 6,
    targets: {
      nodeModules: targets.nodeModules,
      buildArtifacts: targets.buildArtifacts,
      rustArtifacts: targets.rustArtifacts,
      goArtifacts: targets.goArtifacts,
      playwrightArtifacts: targets.playwrightArtifacts,
    },
    additionalDirNames: {
      buildArtifacts: config.additionalDirNames?.buildArtifacts ?? [],
      rustArtifacts: config.additionalDirNames?.rustArtifacts ?? [],
      goArtifacts: config.additionalDirNames?.goArtifacts ?? [],
      playwrightArtifacts: config.additionalDirNames?.playwrightArtifacts ?? [],
    },
    excludeAbsPathContains: config.excludeAbsPathContains ?? [],
    profile: config.profile,
    deleteMode: config.deleteMode,
    staleDays: config.staleDays,
    quarantine: {
      root: config.quarantine?.root,
      retentionDays: config.quarantine?.retentionDays,
    },
    safety: {
      extraProtectedPathContains: config.safety?.extraProtectedPathContains ?? [],
      allowPathContains: config.safety?.allowPathContains ?? [],
    },
  };
}

export async function readAndValidateConfigFile(configPath: string): Promise<NormalizedDiskCleanupConfig> {
  const content = await readFile(configPath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON in ${configPath}: ${detail}`);
  }
  return normalizeConfig(validateConfig(parsed));
}

export async function loadConfig(explicitPath?: string): Promise<NormalizedDiskCleanupConfig | null> {
  const configPath = explicitPath ?? path.join(process.cwd(), '.deco', 'disk-cleanup.json');
  try {
    return await readAndValidateConfigFile(configPath);
  } catch (error: unknown) {
    if (explicitPath) throw error;
    return null;
  }
}
