import { describe, expect, it } from 'vitest';
import { compactListPath } from '../../frontend/src/lib/format';

describe('compactListPath', () => {
  it('returns short paths unchanged', () => {
    expect(compactListPath('G:/repo/app')).toBe('G:/repo/app');
  });

  it('compresses long paths with head and tail', () => {
    const long =
      'G:/Web Development Project/Codebases/mode-toggle-set/mode-switching/node_modules';
    const out = compactListPath(long);
    expect(out.length).toBeLessThanOrEqual(56);
    expect(out).toContain('…');
    expect(out).toMatch(/mode-switching|node_modules/);
  });

  it('preserves drive letter on Windows-style paths', () => {
    const out = compactListPath(
      'G:/Web Development Project/Codebases/foo/bar/baz/qux/node_modules',
    );
    expect(out.startsWith('G:/')).toBe(true);
  });
});
