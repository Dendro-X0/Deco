import { describe, expect, it } from 'vitest';
import { dormancySummary } from '../../frontend/src/lib/dormancy-signals';
import type { Candidate } from '../../frontend/src/types';

function candidate(partial: Partial<Candidate>): Candidate {
  return {
    id: '1',
    abs_path: 'C:\\proj\\node_modules',
    kind: 'node_modules',
    risk: 'safe',
    reason_codes: [],
    ...partial,
  };
}

describe('dormancy-signals', () => {
  it('labels stale node_modules from reason codes', () => {
    const summary = dormancySummary(
      candidate({
        stale_days: 60,
        reason_codes: ['PROJECT_MARKERS_PRESENT', 'NODE_MODULES_STALE'],
      }),
      45,
      1_700_000_000_000,
    );
    expect(summary.tone).toBe('stale');
    expect(summary.headline).toContain('60 day');
  });

  it('labels recent node_modules below threshold', () => {
    const summary = dormancySummary(
      candidate({
        stale_days: 10,
        reason_codes: ['PROJECT_MARKERS_PRESENT', 'NODE_MODULES_NOT_STALE'],
      }),
      45,
    );
    expect(summary.tone).toBe('recent');
    expect(summary.headline).toContain('Recently touched');
  });

  it('derives age from mtime when stale_days missing', () => {
    const now = 1_700_000_000_000;
    const mtime = now - 20 * 86_400_000;
    const summary = dormancySummary(
      candidate({ mtime_ms: mtime, reason_codes: ['PROJECT_MARKERS_PRESENT'] }),
      15,
      now,
    );
    expect(summary.headline).toContain('20 day');
  });
});
