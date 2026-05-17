import { describe, expect, it } from 'vitest';
import {
  countEnabledInCategory,
  patchCategorySelection,
} from '../../frontend/src/lib/discovery-options';
import { normalizeSettings } from '../../frontend/src/lib/settings-normalize';
import { isSettingsDraftDirty } from '../../frontend/src/lib/settings-draft';

describe('discovery-options', () => {
  it('selects all package manager toggles in one patch', () => {
    const base = normalizeSettings({});
    const patch = patchCategorySelection('package_managers', true);
    const next = normalizeSettings({ ...base, ...patch });
    expect(next.check_npm_cache).toBe(true);
    expect(next.check_pnpm_store).toBe(true);
    expect(next.check_conda_pkgs_cache).toBe(true);
    expect(countEnabledInCategory(next, 'package_managers').enabled).toBe(6);
  });

  it('marks draft dirty when a discovery toggle changes', () => {
    const saved = normalizeSettings({ check_npm_cache: false });
    const draft = { ...saved, check_npm_cache: true };
    expect(isSettingsDraftDirty(draft, saved)).toBe(true);
  });
});
