import type { CleanupProfileId } from '@/lib/cleanup-profiles';
import type { ScanStrategyId } from '@/lib/scan-strategy';
import type { Settings } from '@/types';

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

function presetOptionShort(t: TranslateFn, key: string): string {
  const full = t(key);
  const dash = full.indexOf(' —');
  return dash >= 0 ? full.slice(0, dash) : full;
}

export function cleanupProfileLabel(t: TranslateFn, id: CleanupProfileId): string {
  if (id === 'custom') return t('common.custom');
  return t(`settings.presets.cleanup.${id}.label`);
}

export function cleanupProfileDescription(t: TranslateFn, id: CleanupProfileId): string {
  if (id === 'custom') return '';
  return t(`settings.presets.cleanup.${id}.description`);
}

export function scanStrategyLabel(t: TranslateFn, id: ScanStrategyId): string {
  if (id === 'custom') return t('common.custom');
  return t(`settings.presets.scanStrategy.${id}.label`);
}

export function scanStrategyDescription(t: TranslateFn, id: ScanStrategyId): string {
  if (id === 'custom') return '';
  return t(`settings.presets.scanStrategy.${id}.description`);
}

export function cleanupProfileSummaryLocalized(
  t: TranslateFn,
  id: CleanupProfileId,
  settings: Settings,
): string {
  const label = cleanupProfileLabel(t, id);
  const scope = settings.scan_scope ?? 'all';
  const scopeLabel = t(`dashboard.scanScope.${scope}`);
  const safety = settings.profile ?? 'safe';
  const safetyLabel =
    t(`dashboard.scanTargets.profiles.${safety}`) ||
    t(`settings.presets.safetyProfile.${safety}`);
  return `${label} · ${t('dashboard.summary.scope', { scope: scopeLabel })} · ${t('dashboard.summary.profile', { profile: safetyLabel })}`;
}

export function scanStrategySummaryLocalized(
  t: TranslateFn,
  id: ScanStrategyId,
  settings: Settings,
): string {
  const label = scanStrategyLabel(t, id);
  const depth = settings.max_depth ?? 8;
  const mode = settings.scan_concurrency_mode ?? 'auto';
  const modeLabel = presetOptionShort(t, `settings.presets.concurrency.${mode}`);
  const quick = settings.incremental_inventory_enabled !== false;
  const parts = [
    label,
    t('dashboard.summary.depth', { depth }),
    t('dashboard.summary.size', { mode: modeLabel }),
  ];
  if (quick) parts.push(t('dashboard.summary.quickUpdateOn'));
  return parts.join(' · ');
}
