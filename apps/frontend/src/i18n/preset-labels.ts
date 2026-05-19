import type { CleanupProfileId } from '@/lib/cleanup-profiles';
import type { ScanStrategyId } from '@/lib/scan-strategy';

export type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

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
