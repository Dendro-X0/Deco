import { DISCOVERY_OPTION_KEYS } from './discovery-options';
import {
  SCAN_STRATEGY_TUNING_KEYS,
  applyScanStrategyPreset,
  deriveScanStrategy,
  type ScanStrategyPreset,
} from './scan-strategy';
import type { Settings } from '../types';

export type CleanupProfileId =
  | 'first_scan'
  | 'monorepo_maintainer'
  | 'ci_agent'
  | 'custom';

export type CleanupProfilePreset = Exclude<CleanupProfileId, 'custom'>;

/** Settings fields applied by a cleanup profile preset (excludes scan targets). */
export const CLEANUP_PROFILE_TUNING_KEYS = [
  'scan_scope',
  'profile',
  'stale_days',
  'include_project_folders',
  'smart_discovery_enabled',
  ...SCAN_STRATEGY_TUNING_KEYS,
  ...DISCOVERY_OPTION_KEYS,
] as const satisfies readonly (keyof Settings)[];

export type CleanupProfileTuning = Pick<
  Settings,
  (typeof CLEANUP_PROFILE_TUNING_KEYS)[number]
>;

export type CleanupProfileMeta = {
  id: CleanupProfilePreset;
  label: string;
  description: string;
  tuning: CleanupProfileTuning;
};

const ALL_GLOBAL_CACHES_OFF: Pick<
  Settings,
  | 'check_go_cache'
  | 'check_jvm_global_cache'
  | 'check_ide_global_cache'
  | 'check_npm_cache'
  | 'check_pnpm_store'
  | 'check_yarn_cache'
  | 'check_pip_cache'
  | 'check_uv_cache'
  | 'check_conda_pkgs_cache'
  | 'check_bun_cache'
  | 'check_cargo_registry'
  | 'check_nuget_cache'
  | 'check_composer_cache'
  | 'check_vcpkg_cache'
  | 'check_conan_cache'
  | 'check_ccache'
  | 'check_sccache'
  | 'check_bazel_disk_cache'
  | 'include_python_venv'
> = {
  check_go_cache: false,
  check_jvm_global_cache: false,
  check_ide_global_cache: false,
  check_npm_cache: false,
  check_pnpm_store: false,
  check_yarn_cache: false,
  check_pip_cache: false,
  check_uv_cache: false,
  check_conda_pkgs_cache: false,
  check_bun_cache: false,
  check_cargo_registry: false,
  check_nuget_cache: false,
  check_composer_cache: false,
  check_vcpkg_cache: false,
  check_conan_cache: false,
  check_ccache: false,
  check_sccache: false,
  check_bazel_disk_cache: false,
  include_python_venv: false,
};

function profileTuning(
  scanStrategy: ScanStrategyPreset,
  extra: Partial<CleanupProfileTuning>,
): CleanupProfileTuning {
  return {
    scan_scope: 'all',
    profile: 'safe',
    stale_days: 45,
    include_project_folders: true,
    smart_discovery_enabled: false,
    include_size: true,
    ...ALL_GLOBAL_CACHES_OFF,
    ...applyScanStrategyPreset(scanStrategy),
    ...extra,
  } as CleanupProfileTuning;
}

export const CLEANUP_PROFILE_PRESETS: CleanupProfileMeta[] = [
  {
    id: 'first_scan',
    label: 'First scan',
    description:
      'Conservative safety, thorough walk, all scope — audit before enabling global caches.',
    tuning: profileTuning('thorough', {
      scan_scope: 'all',
      profile: 'safe',
      stale_days: 45,
      smart_discovery_enabled: false,
    }),
  },
  {
    id: 'monorepo_maintainer',
    label: 'Monorepo maintainer',
    description:
      'Balanced defaults with package-manager and registry caches plus smart IDE patterns.',
    tuning: profileTuning('balanced', {
      scan_scope: 'all',
      profile: 'balanced',
      stale_days: 30,
      smart_discovery_enabled: true,
      check_npm_cache: true,
      check_pnpm_store: true,
      check_yarn_cache: true,
      check_cargo_registry: true,
      check_pip_cache: true,
      check_uv_cache: true,
    }),
  },
  {
    id: 'ci_agent',
    label: 'CI agent',
    description:
      'Fast shallow pass, drive roots, compiler caches — typical build-agent reclaim.',
    tuning: profileTuning('fast', {
      scan_scope: 'drives',
      profile: 'balanced',
      stale_days: 14,
      include_project_folders: false,
      smart_discovery_enabled: false,
      check_npm_cache: true,
      check_pnpm_store: true,
      check_cargo_registry: true,
      check_ccache: true,
      check_sccache: true,
      check_go_cache: true,
    }),
  },
];

const PRESET_BY_ID = Object.fromEntries(
  CLEANUP_PROFILE_PRESETS.map((p) => [p.id, p]),
) as Record<CleanupProfilePreset, CleanupProfileMeta>;

export function normalizeCleanupProfileId(raw: unknown): CleanupProfileId {
  const s = String(raw ?? '').toLowerCase();
  if (s === 'first_scan' || s === 'monorepo_maintainer' || s === 'ci_agent' || s === 'custom') {
    return s;
  }
  return 'custom';
}

export function cleanupProfileMeta(id: CleanupProfileId): CleanupProfileMeta | null {
  if (id === 'custom') return null;
  return PRESET_BY_ID[id];
}

export function cleanupProfileLabel(id: CleanupProfileId): string {
  if (id === 'custom') return 'Custom';
  return PRESET_BY_ID[id].label;
}

function pickProfileTuning(settings: Settings): CleanupProfileTuning {
  const out = {} as CleanupProfileTuning;
  for (const key of CLEANUP_PROFILE_TUNING_KEYS) {
    (out as Record<string, unknown>)[key] = settings[key];
  }
  return out;
}

function profileTuningMatches(a: CleanupProfileTuning, b: CleanupProfileTuning): boolean {
  for (const key of CLEANUP_PROFILE_TUNING_KEYS) {
    const av = a[key];
    const bv = b[key];
    if (typeof av === 'boolean' || typeof bv === 'boolean') {
      if (Boolean(av) !== Boolean(bv)) return false;
    } else if (av !== bv) {
      return false;
    }
  }
  const aStrategy = deriveScanStrategy(a as Settings);
  const bStrategy = deriveScanStrategy(b as Settings);
  return aStrategy === bStrategy;
}

/** Infer preset from current settings; `custom` when no bundle matches. */
export function deriveCleanupProfile(settings: Settings): CleanupProfileId {
  const tuning = pickProfileTuning(settings);
  for (const preset of CLEANUP_PROFILE_PRESETS) {
    if (profileTuningMatches(tuning, preset.tuning)) return preset.id;
  }
  return 'custom';
}

export function resolveCleanupProfile(settings: Settings): CleanupProfileId {
  const stored = normalizeCleanupProfileId(settings.cleanup_profile);
  if (stored !== 'custom' && deriveCleanupProfile(settings) === stored) {
    return stored;
  }
  return deriveCleanupProfile(settings);
}

export function applyCleanupProfilePreset(
  preset: CleanupProfilePreset,
): Partial<Settings> {
  const meta = PRESET_BY_ID[preset];
  return {
    cleanup_profile: preset,
    ...meta.tuning,
    scan_strategy: deriveScanStrategy(meta.tuning as Settings),
  };
}

export function cleanupProfileSummary(id: CleanupProfileId, settings: Settings): string {
  const label = cleanupProfileLabel(id);
  const scope = settings.scan_scope ?? 'all';
  const safety = settings.profile ?? 'safe';
  return `${label} · scope ${scope} · ${safety} profile`;
}

export function patchWithProfileTuning(
  settings: Settings,
  patch: Partial<Settings>,
): Partial<Settings> {
  const merged = { ...settings, ...patch };
  const nextProfile =
    patch.cleanup_profile !== undefined
      ? normalizeCleanupProfileId(patch.cleanup_profile)
      : deriveCleanupProfile(merged);
  const nextStrategy = deriveScanStrategy(merged);
  return { ...patch, cleanup_profile: nextProfile, scan_strategy: nextStrategy };
}
