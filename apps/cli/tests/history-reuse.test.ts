import { describe, expect, it } from 'vitest';
import type { HistoryItem, Settings } from '../../frontend/src/types';
import {
  inferHistoryScanMode,
  historyReuseError,
  settingsFromHistoryItem,
} from '../../frontend/src/lib/history-reuse';
import { normalizeSettings } from '../../frontend/src/lib/settings-normalize';

function baseSettings(): Settings {
  return normalizeSettings({
    roots: [],
    use_custom_scan_roots: false,
    selected_volumes: ['C:\\'],
    profile: 'safe',
    stale_days: 45,
  });
}

function item(roots: string[]): HistoryItem {
  return {
    scan_id: 'x',
    created_at: '2026-05-15T12:00:00Z',
    roots,
    profile: 'balanced',
    stale_days: 30,
    total_bytes: 1024,
  };
}

describe('history-reuse', () => {
  it('detects custom vs partition roots', () => {
    expect(inferHistoryScanMode(['F:\\', 'F:\\Users'])).toBe('partition');
    expect(inferHistoryScanMode(['G:\\Web Development Project'])).toBe('custom');
  });

  it('builds custom settings from history', () => {
    const next = settingsFromHistoryItem(
      item(['G:\\Web Development Project']),
      baseSettings(),
    );
    expect(next.use_custom_scan_roots).toBe(true);
    expect(next.roots).toEqual(['G:\\Web Development Project']);
    expect(next.profile).toBe('balanced');
  });

  it('reports reuse errors for unmapped drives', () => {
    const roots = ['relative/no-drive'];
    const next = settingsFromHistoryItem(item(roots), baseSettings());
    expect(historyReuseError(item(roots), next)).toMatch(/drive/i);
  });
});
