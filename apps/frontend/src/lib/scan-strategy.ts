import type { Settings } from '../types';

export type ScanStrategyId = 'thorough' | 'balanced' | 'fast' | 'background' | 'custom';

export type ScanStrategyPreset = Exclude<ScanStrategyId, 'custom'>;

/** Settings fields controlled by a scan strategy preset. */
export const SCAN_STRATEGY_TUNING_KEYS = [
  'max_depth',
  'scan_concurrency_mode',
  'incremental_inventory_enabled',
] as const satisfies readonly (keyof Settings)[];

export type ScanStrategyTuning = Pick<
  Settings,
  (typeof SCAN_STRATEGY_TUNING_KEYS)[number]
>;

export type ScanStrategyMeta = {
  id: ScanStrategyPreset;
  label: string;
  description: string;
  tuning: ScanStrategyTuning;
};

export const SCAN_STRATEGY_PRESETS: ScanStrategyMeta[] = [
  {
    id: 'thorough',
    label: 'Thorough',
    description: 'Deeper search, balanced parallelism — best for first scan or audit.',
    tuning: {
      max_depth: 10,
      scan_concurrency_mode: 'auto',
      incremental_inventory_enabled: true,
    },
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Default trade-off for most machines and repeat scans.',
    tuning: {
      max_depth: 8,
      scan_concurrency_mode: 'auto',
      incremental_inventory_enabled: true,
    },
  },
  {
    id: 'fast',
    label: 'Fast',
    description: 'Shallower walk, higher size parallelism — SSD / NVMe friendly.',
    tuning: {
      max_depth: 6,
      scan_concurrency_mode: 'high',
      incremental_inventory_enabled: true,
    },
  },
  {
    id: 'background',
    label: 'Background',
    description: 'Gentle disk use — HDD or low-priority scans.',
    tuning: {
      max_depth: 5,
      scan_concurrency_mode: 'low',
      incremental_inventory_enabled: true,
    },
  },
];

const PRESET_BY_ID = Object.fromEntries(
  SCAN_STRATEGY_PRESETS.map((p) => [p.id, p]),
) as Record<ScanStrategyPreset, ScanStrategyMeta>;

export function normalizeScanStrategyId(raw: unknown): ScanStrategyId {
  const s = String(raw ?? '').toLowerCase();
  if (
    s === 'thorough' ||
    s === 'balanced' ||
    s === 'fast' ||
    s === 'background' ||
    s === 'custom'
  ) {
    return s;
  }
  return 'balanced';
}

export function scanStrategyMeta(id: ScanStrategyId): ScanStrategyMeta | null {
  if (id === 'custom') return null;
  return PRESET_BY_ID[id];
}

export function scanStrategyLabel(id: ScanStrategyId): string {
  if (id === 'custom') return 'Custom';
  return PRESET_BY_ID[id].label;
}

export function scanStrategySummary(id: ScanStrategyId, settings: Settings): string {
  const label = scanStrategyLabel(id);
  const depth = settings.max_depth ?? 8;
  const mode = settings.scan_concurrency_mode ?? 'auto';
  const quick = settings.incremental_inventory_enabled !== false;
  return `${label} · depth ${depth} · size ${mode}${quick ? ' · Quick update on' : ''}`;
}

function tuningMatches(a: ScanStrategyTuning, b: ScanStrategyTuning): boolean {
  return (
    a.max_depth === b.max_depth &&
    a.scan_concurrency_mode === b.scan_concurrency_mode &&
    Boolean(a.incremental_inventory_enabled) === Boolean(b.incremental_inventory_enabled)
  );
}

export function readStrategyTuning(settings: Settings): ScanStrategyTuning {
  return {
    max_depth: settings.max_depth ?? 8,
    scan_concurrency_mode: settings.scan_concurrency_mode ?? 'auto',
    incremental_inventory_enabled: settings.incremental_inventory_enabled !== false,
  };
}

/** Infer preset from tuning knobs; returns `custom` when no preset matches exactly. */
export function deriveScanStrategy(settings: Settings): ScanStrategyId {
  const tuning = readStrategyTuning(settings);
  for (const preset of SCAN_STRATEGY_PRESETS) {
    if (tuningMatches(tuning, preset.tuning)) return preset.id;
  }
  return 'custom';
}

/** Active strategy from current tuning knobs (stored label may be stale until save). */
export function resolveScanStrategy(settings: Settings): ScanStrategyId {
  return deriveScanStrategy(settings);
}

export function applyScanStrategyPreset(
  preset: ScanStrategyPreset,
): Partial<Settings> {
  const meta = PRESET_BY_ID[preset];
  return {
    scan_strategy: preset,
    ...meta.tuning,
  };
}

export function patchWithStrategyTuning(
  settings: Settings,
  patch: Partial<Settings>,
): Partial<Settings> {
  const merged = { ...settings, ...patch };
  const nextStrategy =
    patch.scan_strategy !== undefined
      ? normalizeScanStrategyId(patch.scan_strategy)
      : deriveScanStrategy(merged);
  return { ...patch, scan_strategy: nextStrategy };
}
