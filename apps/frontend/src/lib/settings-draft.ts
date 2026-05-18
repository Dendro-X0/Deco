import type { Settings } from '../types';
import { DISCOVERY_OPTION_KEYS } from './discovery-options';
import { patchWithProfileTuning } from './cleanup-profiles';
import { patchWithStrategyTuning } from './scan-strategy';
import { normalizeSettings } from './settings-normalize';
import { volumeMountsFromPaths } from './volume-from-path';

/** Scan targets are edited on the Dashboard and saved immediately — not part of Settings draft. */
export const SCAN_TARGET_SETTINGS_KEYS = [
  'roots',
  'use_custom_scan_roots',
  'selected_volumes',
  'include_project_folders',
] as const satisfies readonly (keyof Settings)[];

/** Fields compared for unsaved-changes detection. */
const DRAFT_KEYS: (keyof Settings)[] = [
  'scan_scope',
  'cleanup_profile',
  'scan_strategy',
  'smart_discovery_enabled',
  'classify_parallel_threshold',
  'incremental_inventory_enabled',
  'fast_dependency_size_estimate',
  'scan_concurrency_mode',
  'max_depth',
  'profile',
  'stale_days',
  'show_blocked',
  'include_python_artifacts',
  'include_jvm_artifacts',
  'include_dotnet_artifacts',
  ...DISCOVERY_OPTION_KEYS,
  'fast_tree_delete_enabled',
  'cleanup_disk_mode',
  'delete_mode',
  'quarantine_layout',
  'quarantine_custom_path',
  'quarantine_retention_days',
  'advanced_mode',
  'default_target_gb',
];

function pickDraftSlice(s: Settings): Record<string, unknown> {
  const n = normalizeSettings(s);
  const out: Record<string, unknown> = {};
  for (const key of DRAFT_KEYS) {
    out[key] = n[key];
  }
  return out;
}

export function cloneSettingsDraft(source: Settings): Settings {
  return normalizeSettings(structuredClone(source));
}

export function isSettingsDraftDirty(draft: Settings, saved: Settings | null): boolean {
  if (!saved) return true;
  return JSON.stringify(pickDraftSlice(draft)) !== JSON.stringify(pickDraftSlice(saved));
}

export function patchSettingsDraft(draft: Settings, patch: Partial<Settings>): Settings {
  const enriched = patchWithProfileTuning(draft, patchWithStrategyTuning(draft, patch));
  const next = cloneSettingsDraft({ ...draft, ...enriched });
  if (patch.roots) {
    const fromRoots = volumeMountsFromPaths(patch.roots);
    const volumes = next.selected_volumes ?? [];
    next.selected_volumes = [...new Set([...volumes, ...fromRoots])].sort();
  }
  return next;
}

export function clampStaleDays(value: number): number {
  if (!Number.isFinite(value)) return 45;
  return Math.min(365, Math.max(1, Math.round(value)));
}

export function clampMaxDepth(value: number): number {
  if (!Number.isFinite(value)) return 8;
  return Math.min(32, Math.max(1, Math.round(value)));
}

/** Keep dashboard-owned scan targets when saving from Settings. */
export function mergeSettingsSavePreservingScanTargets(
  draft: Settings,
  saved: Settings,
): Settings {
  return {
    ...draft,
    roots: saved.roots,
    use_custom_scan_roots: saved.use_custom_scan_roots,
    selected_volumes: saved.selected_volumes,
    include_project_folders: saved.include_project_folders,
  };
}
