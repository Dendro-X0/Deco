import { describe, expect, it } from 'vitest';
import {
  NO_SCAN_BYTES_LABEL,
  formatStatBytes,
} from '../../frontend/src/lib/format';

describe('formatStatBytes', () => {
  it('shows placeholder before any scan', () => {
    expect(formatStatBytes(undefined, false)).toBe(NO_SCAN_BYTES_LABEL);
    expect(formatStatBytes(1024, false)).toBe(NO_SCAN_BYTES_LABEL);
  });

  it('shows real bytes after scan including zero', () => {
    expect(formatStatBytes(0, true)).toBe('0.00 B');
    expect(formatStatBytes(1024, true)).toBe('1.00 KB');
  });
});
