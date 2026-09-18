import { describe, expect, it } from 'vitest';
import {
  destInsufficientFreeSpaceError,
  requiredDestFreeBytes,
  sourceLowFreeSpaceWarning,
} from '../src/tool-migration-free-space.js';

describe('tool-migration-free-space', () => {
  it('requires 1.2× dest free space', () => {
    const needed = 10 * 1024 * 1024 * 1024;
    expect(requiredDestFreeBytes(needed)).toBe(12 * 1024 * 1024 * 1024);
    expect(destInsufficientFreeSpaceError(needed, needed, 'G:\\')).toMatch(/1\.2/);
    expect(destInsufficientFreeSpaceError(needed, requiredDestFreeBytes(needed), 'G:\\')).toBeNull();
    expect(destInsufficientFreeSpaceError(0, 0, 'G:\\')).toBeNull();
  });

  it('warns when source free space is under 2 GB or 5%', () => {
    const twoGb = 2 * 1024 * 1024 * 1024;
    const total = 100 * 1024 * 1024 * 1024;
    expect(sourceLowFreeSpaceWarning(twoGb - 1, total, 'C:\\')).toMatch(/low on free space/);
    expect(sourceLowFreeSpaceWarning((total * 4) / 100, total, 'C:\\')).toMatch(/low on free space/);
    expect(sourceLowFreeSpaceWarning(10 * 1024 * 1024 * 1024, total, 'C:\\')).toBeNull();
  });
});
