import { describe, expect, it } from 'vitest';
import {
  SIZE_NOT_CALCULATED_LABEL,
  formatCandidateSize,
  formatBytes,
} from '../../frontend/src/lib/format';

describe('formatCandidateSize', () => {
  it('shows bytes when known', () => {
    expect(formatCandidateSize(1024, false)).toBe(formatBytes(1024));
    expect(formatCandidateSize(0, false)).toBe('0.00 B');
  });

  it('shows sizing label while scan is active', () => {
    expect(formatCandidateSize(undefined, true)).toBe('Sizing…');
  });

  it('shows not calculated after scan when size is unknown', () => {
    expect(formatCandidateSize(undefined, false)).toBe(SIZE_NOT_CALCULATED_LABEL);
  });
});
