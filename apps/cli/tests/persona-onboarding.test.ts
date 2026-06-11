import { describe, expect, it } from 'vitest';
import {
  applyCleanupProfilePreset,
  deriveCleanupProfile,
} from '../../frontend/src/lib/cleanup-profiles';
import {
  isSystemVolume,
  shouldSuggestProfileAlignment,
  suggestedProfileForAlignment,
  suggestedProjectVolumes,
} from '../../frontend/src/lib/persona-onboarding';
import type { Settings, StorageVolume } from '../../frontend/src/types';

function baseSettings(): Settings {
  return {
    ...applyCleanupProfilePreset('first_scan'),
    cleanup_profile: 'first_scan',
    selected_volumes: ['C:\\', 'E:\\'],
    roots: [],
    use_custom_scan_roots: false,
  } as Settings;
}

describe('persona-onboarding', () => {
  it('treats C: as system volume on Windows', () => {
    expect(isSystemVolume('C:\\', 'C:\\')).toBe(true);
    expect(isSystemVolume('E:\\', 'C:\\')).toBe(false);
  });

  it('suggests non-system fixed volumes first', () => {
    const volumes: StorageVolume[] = [
      {
        mount_point: 'C:\\',
        name: 'OS',
        volume_kind: 'fixed',
        total_bytes: 100,
        used_bytes: 50,
        available_bytes: 50,
      },
      {
        mount_point: 'E:\\',
        name: 'Data',
        volume_kind: 'fixed',
        total_bytes: 100,
        used_bytes: 10,
        available_bytes: 90,
      },
    ];
    expect(suggestedProjectVolumes(volumes, 'C:\\')).toEqual(['E:\\']);
  });

  it('flags profile alignment when tuning diverges from stored preset', () => {
    const settings = {
      ...baseSettings(),
      ...applyCleanupProfilePreset('monorepo_maintainer'),
      cleanup_profile: 'first_scan',
    } as Settings;
    expect(deriveCleanupProfile(settings)).toBe('monorepo_maintainer');
    expect(shouldSuggestProfileAlignment(settings)).toBe(true);
    expect(suggestedProfileForAlignment(settings)).toBe('monorepo_maintainer');
  });

  it('suggests alignment when tuning is custom but stored preset is not', () => {
    const settings = baseSettings();
    settings.check_npm_cache = true;
    expect(deriveCleanupProfile(settings)).toBe('custom');
    expect(shouldSuggestProfileAlignment(settings)).toBe(true);
    expect(suggestedProfileForAlignment(settings)).toBeNull();
  });

  it('does not suggest alignment for custom stored profile', () => {
    const settings = baseSettings();
    settings.cleanup_profile = 'custom';
    settings.check_npm_cache = true;
    expect(shouldSuggestProfileAlignment(settings)).toBe(false);
  });
});
