import { describe, expect, it } from 'vitest';
import {
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
});
