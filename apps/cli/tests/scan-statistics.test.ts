import { describe, expect, it } from 'vitest';
import {
  formatPhaseTimingLine,
  inventoryReusePercent,
  phaseShares,
  readPhaseTimings,
  topKindsByBytes,
} from '../../frontend/src/lib/scan-statistics';
import type { ScanReport } from '../../frontend/src/types';

describe('scan-statistics', () => {
  it('reads phase timings from snake or camelCase', () => {
    expect(readPhaseTimings({ discover_ms: 100, classify_ms: 200, size_ms: 300 })).toEqual({
      discoverMs: 100,
      classifyMs: 200,
      sizeMs: 300,
    });
    expect(readPhaseTimings({ discoverMs: 1, classifyMs: 2, sizeMs: 3 })).toEqual({
      discoverMs: 1,
      classifyMs: 2,
      sizeMs: 3,
    });
  });

  it('computes phase shares', () => {
    const shares = phaseShares({ discoverMs: 1000, classifyMs: 2000, sizeMs: 2000 });
    expect(shares.find((s) => s.phase === 'classifyMs')?.percent).toBe(40);
  });

  it('formats timing line', () => {
    expect(formatPhaseTimingLine({ discoverMs: 500, classifyMs: 1500, sizeMs: 800 })).toContain(
      'Classify',
    );
  });

  it('computes inventory reuse percent', () => {
    expect(inventoryReusePercent(30, 100)).toBe(30);
    expect(inventoryReusePercent(0, 10)).toBeNull();
  });

  it('ranks kinds by bytes', () => {
    const report = {
      totals_by_kind: {
        node_modules: { count: 2, bytes: 100 },
        target: { count: 1, bytes: 500 },
      },
    } as ScanReport;
    const top = topKindsByBytes(report);
    expect(top[0]?.kind).toBe('target');
  });
});
