import { describe, expect, it } from 'vitest';
import type { QuarantineEntry } from '../../frontend/src/types';
import {
  countPurgeEligible,
  daysUntilPurgeEligible,
  filterQuarantineEntries,
  isPurgeEligible,
  quarantineFilterFromInputs,
} from '../../frontend/src/lib/quarantine-filter';

function row(id: string, path: string, iso: string, bytes: number): QuarantineEntry {
  return {
    id,
    original_path: path,
    timestamp_iso: iso,
    size_bytes: bytes,
    reason_summary: 'test',
  };
}

describe('quarantine-filter', () => {
  const now = new Date('2026-05-15T22:00:00Z').getTime();
  const entries = [
    row('a', 'F:\\proj\\cache', '2026-05-15T21:00:00Z', 2 * 1024 ** 3),
    row('b', 'G:\\old\\dist', '2026-04-01T12:00:00Z', 500 * 1024 ** 2),
  ];

  it('filters by drive and size', () => {
    const filters = quarantineFilterFromInputs('', '400MB', '1GB', 'all', 'G:\\', false);
    const out = filterQuarantineEntries(entries, filters, 30, now);
    expect(out.map((e) => e.id)).toEqual(['b']);
  });

  it('computes purge eligibility', () => {
    expect(isPurgeEligible('2026-04-01T12:00:00Z', 30, now)).toBe(true);
    expect(daysUntilPurgeEligible('2026-05-15T21:00:00Z', 30, now)).toBeGreaterThan(0);
    expect(countPurgeEligible(entries, 30, now)).toBe(1);
  });
});
