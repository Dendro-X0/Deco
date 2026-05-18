import { describe, expect, it } from 'vitest';
import {
  applyCleanupProfilePreset,
  deriveCleanupProfile,
} from '../../frontend/src/lib/cleanup-profiles';
import { normalizeSettings } from '../../frontend/src/lib/settings-normalize';

function base(): ReturnType<typeof normalizeSettings> {
  return normalizeSettings({
    max_depth: 8,
    scan_concurrency_mode: 'auto',
    incremental_inventory_enabled: true,
    scan_strategy: 'balanced',
    profile: 'safe',
    scan_scope: 'projects',
  });
}

describe('cleanup-profiles', () => {
  it('derives custom from default tuning', () => {
    expect(deriveCleanupProfile(base())).toBe('custom');
  });

  it('applies first_scan preset', () => {
    const next = { ...base(), ...applyCleanupProfilePreset('first_scan') };
    expect(deriveCleanupProfile(next)).toBe('first_scan');
    expect(next.profile).toBe('safe');
    expect(next.scan_scope).toBe('all');
    expect(next.max_depth).toBe(10);
  });

  it('marks custom when discovery diverges', () => {
    const custom = { ...base(), ...applyCleanupProfilePreset('monorepo_maintainer'), check_npm_cache: false };
    expect(deriveCleanupProfile(custom)).toBe('custom');
  });

  it('applies monorepo_maintainer and ci_agent presets', () => {
    const mono = { ...base(), ...applyCleanupProfilePreset('monorepo_maintainer') };
    expect(deriveCleanupProfile(mono)).toBe('monorepo_maintainer');
    expect(mono.check_pnpm_store).toBe(true);
    expect(mono.smart_discovery_enabled).toBe(true);

    const ci = { ...base(), ...applyCleanupProfilePreset('ci_agent') };
    expect(deriveCleanupProfile(ci)).toBe('ci_agent');
    expect(ci.scan_scope).toBe('drives');
    expect(ci.check_ccache).toBe(true);
    expect(ci.include_project_folders).toBe(false);
  });
});
