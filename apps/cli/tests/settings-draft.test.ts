import { describe, expect, it } from 'vitest';
import type { Settings } from '../../frontend/src/types';
import {
  clampMaxDepth,
  clampStaleDays,
  isSettingsDraftDirty,
  patchSettingsDraft,
} from '../../frontend/src/lib/settings-draft';
import { normalizeSettings } from '../../frontend/src/lib/settings-normalize';

function base(): Settings {
  return normalizeSettings({
    roots: [],
    use_custom_scan_roots: false,
    scan_scope: 'all',
    selected_volumes: ['C:\\'],
    profile: 'safe',
    stale_days: 45,
    max_depth: 8,
    include_size: true,
    advanced_mode: false,
  });
}

describe('settings-draft', () => {
  it('detects dirty when profile changes', () => {
    const saved = base();
    const draft = { ...saved, profile: 'balanced' };
    expect(isSettingsDraftDirty(draft, saved)).toBe(true);
  });

  it('merges drive letters when custom roots change', () => {
    const draft = patchSettingsDraft(base(), { roots: ['G:\\Projects'] });
    expect(draft.selected_volumes).toContain('G:\\');
  });

  it('clamps numeric fields', () => {
    expect(clampStaleDays(999)).toBe(365);
    expect(clampMaxDepth(0)).toBe(1);
  });
});
