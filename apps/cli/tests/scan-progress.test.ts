import { describe, expect, it } from 'vitest';
import {
  computeScanProgressPercent,
  IDLE_PROGRESS,
  scanProgressPhaseLabel,
} from '../../frontend/src/lib/scan-progress';

describe('scan-progress', () => {
  it('labels known phases', () => {
    expect(scanProgressPhaseLabel('discover')).toBe('Discover');
    expect(scanProgressPhaseLabel('size')).toBe('Size');
    expect(scanProgressPhaseLabel(null)).toBeNull();
  });

  it('idle progress has no phase', () => {
    expect(IDLE_PROGRESS.phase).toBeNull();
  });

  it('keeps classify in a narrow progress band', () => {
    const half = computeScanProgressPercent('classify', { classified: 50, total: 100 });
    const done = computeScanProgressPercent('classify', { classified: 100, total: 100 });
    expect(half).toBeGreaterThanOrEqual(38);
    expect(done).toBeLessThanOrEqual(45);
  });

  it('maps most of the bar to size', () => {
    const start = computeScanProgressPercent('size', { sized: 0, total: 100 });
    const mid = computeScanProgressPercent('size', { sized: 50, total: 100 });
    const end = computeScanProgressPercent('size', { sized: 100, total: 100 });
    expect(start).toBeGreaterThanOrEqual(45);
    expect(mid).toBeGreaterThan(60);
    expect(end).toBe(98);
  });
});
