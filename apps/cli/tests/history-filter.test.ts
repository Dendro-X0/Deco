import { describe, expect, it } from 'vitest';
import type { HistoryItem } from '../../frontend/src/types';
import {
  filterHistoryItems,
  historyFilterFromInputs,
  uniqueHistoryVolumes,
} from '../../frontend/src/lib/history-filter';

function row(
  scanId: string,
  createdAt: string,
  roots: string[],
  totalBytes: number,
): HistoryItem {
  return {
    scan_id: scanId,
    created_at: createdAt,
    roots,
    profile: 'safe',
    stale_days: 30,
    total_bytes: totalBytes,
  };
}

describe('history-filter', () => {
  const now = new Date('2026-05-15T22:00:00Z').getTime();
  const items = [
    row('recent', '2026-05-15T21:30:00Z', ['F:\\Users', 'F:\\'], 50 * 1024 ** 3),
    row('within-24h', '2026-05-15T10:00:00Z', ['G:\\Web Development Project'], 10 * 1024 ** 3),
    row('week-old', '2026-05-08T12:00:00Z', ['E:\\work'], 500 * 1024 ** 2),
  ];

  it('filters by size range', () => {
    const filters = historyFilterFromInputs('5GB', '20GB', 'all', 'all');
    const out = filterHistoryItems(items, filters, now);
    expect(out.map((i) => i.scan_id)).toEqual(['within-24h']);
  });

  it('filters by time range presets', () => {
    const filters = historyFilterFromInputs('', '', '24h', 'all');
    const out = filterHistoryItems(items, filters, now);
    expect(out.map((i) => i.scan_id)).toEqual(['recent', 'within-24h']);
  });

  it('filters by 30-day preset', () => {
    const filters = historyFilterFromInputs('', '', '30d', 'all');
    const out = filterHistoryItems(items, filters, now);
    expect(out.map((i) => i.scan_id)).toEqual(['recent', 'within-24h', 'week-old']);
  });

  it('filters by volume mount', () => {
    const filters = historyFilterFromInputs('', '', 'all', 'F:\\');
    const out = filterHistoryItems(items, filters, now);
    expect(out.map((i) => i.scan_id)).toEqual(['recent']);
  });

  it('collects unique volumes from history', () => {
    expect(uniqueHistoryVolumes(items)).toEqual(['E:\\', 'F:\\', 'G:\\']);
  });
});
