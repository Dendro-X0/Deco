import { describe, expect, it } from 'vitest';
import {
  applyScanStrategyPreset,
  deriveScanStrategy,
  resolveScanStrategy,
} from '../../frontend/src/lib/scan-strategy';
import { normalizeSettings } from '../../frontend/src/lib/settings-normalize';

function base(): ReturnType<typeof normalizeSettings> {
  return normalizeSettings({
    max_depth: 8,
    scan_concurrency_mode: 'auto',
    incremental_inventory_enabled: true,
    scan_strategy: 'balanced',
  });
}

describe('scan-strategy', () => {
  it('derives balanced from default tuning', () => {
    expect(deriveScanStrategy(base())).toBe('balanced');
  });

  it('applies fast preset tuning', () => {
    const next = { ...base(), ...applyScanStrategyPreset('fast') };
    expect(deriveScanStrategy(next)).toBe('fast');
    expect(next.max_depth).toBe(6);
    expect(next.scan_concurrency_mode).toBe('high');
  });

  it('marks custom when tuning diverges', () => {
    const custom = { ...base(), max_depth: 7 };
    expect(deriveScanStrategy(custom)).toBe('custom');
    expect(resolveScanStrategy({ ...custom, scan_strategy: 'balanced' })).toBe('custom');
  });
});
