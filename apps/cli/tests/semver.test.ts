import { describe, expect, it } from 'vitest';
import { compareSemver, isNewerVersion, parseSemver } from '../../frontend/src/lib/semver';

describe('semver', () => {
  it('parses tagged versions', () => {
    expect(parseSemver('v0.6.7')).toEqual([0, 6, 7]);
    expect(parseSemver('0.6.8')).toEqual([0, 6, 8]);
  });

  it('compares versions', () => {
    expect(isNewerVersion('v0.6.8', 'v0.6.7')).toBe(true);
    expect(isNewerVersion('v0.6.7', 'v0.6.8')).toBe(false);
    expect(compareSemver('v0.6.7', 'v0.6.7')).toBe(0);
  });
});
