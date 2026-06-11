import {
  deriveCleanupProfile,
  normalizeCleanupProfileId,
  type CleanupProfilePreset,
} from './cleanup-profiles';
import type { Settings, StorageVolume } from '@/types';

export type { CleanupProfilePreset };

export function defaultSystemMount(): string {
  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent)) {
    return 'C:\\';
  }
  return '/';
}

export function isSystemVolume(mount: string, systemMount = defaultSystemMount()): boolean {
  const norm = (s: string) => s.replace(/[/\\]+$/, '').toLowerCase();
  return norm(mount) === norm(systemMount);
}

/** Prefer fixed non-system drives for project scan targets. */
export function suggestedProjectVolumes(
  volumes: StorageVolume[],
  systemMount = defaultSystemMount(),
): string[] {
  const fixed = volumes.filter((v) => v.volume_kind === 'fixed');
  const nonSystem = fixed.filter((v) => !isSystemVolume(v.mount_point, systemMount));
  if (nonSystem.length > 0) {
    return nonSystem.map((v) => v.mount_point).sort();
  }
  return fixed.map((v) => v.mount_point).sort();
}

/** Stored preset no longer matches tuning — suggest realigning in Settings. */
export function shouldSuggestProfileAlignment(settings: Settings): boolean {
  const stored = normalizeCleanupProfileId(settings.cleanup_profile);
  if (stored === 'custom') return false;
  return deriveCleanupProfile(settings) !== stored;
}

export function suggestedProfileForAlignment(settings: Settings): CleanupProfilePreset | null {
  if (!shouldSuggestProfileAlignment(settings)) return null;
  const derived = deriveCleanupProfile(settings);
  if (derived === 'custom') return null;
  return derived;
}
