import type { Settings } from '../types';
import { normalizeSettings } from './settings-normalize';
import { volumeMountsFromPaths } from './volume-from-path';

/** Fields compared for unsaved-changes detection. */
const DRAFT_KEYS: (keyof Settings)[] = [
  'roots',
  'use_custom_scan_roots',
  'scan_scope',
  'selected_volumes',
  'include_project_folders',
  'max_depth',
  'profile',
  'stale_days',
  'include_size',
  'show_blocked',
  'check_go_cache',
  'include_python_artifacts',
  'include_python_venv',
  'include_jvm_artifacts',
  'check_jvm_global_cache',
  'include_dotnet_artifacts',
  'check_ide_global_cache',
  'delete_mode',
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
  const next = cloneSettingsDraft({ ...draft, ...patch });
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
