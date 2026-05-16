import { describe, expect, it } from 'vitest';
import type { Candidate } from '../../frontend/src/types';
import {
  filterCandidates,
  formatSizeFilterSummary,
  matchSizeFilterPreset,
  parseSizeInput,
  uniqueKinds,
} from '../../frontend/src/lib/candidate-filter';

function row(
  id: string,
  kind: string,
  size: number | undefined,
  path = `E:\\proj\\${id}`,
): Candidate {
  return {
    id,
    abs_path: path,
    kind,
    risk: 'safe',
    size_bytes: size,
  };
}

describe('candidate-filter', () => {
  it('parseSizeInput accepts unit suffixes', () => {
    expect(parseSizeInput('100MB')).toBe(100 * 1024 ** 2);
    expect(parseSizeInput('1.5 GB')).toBe(Math.round(1.5 * 1024 ** 3));
    expect(parseSizeInput('')).toBeNull();
    expect(parseSizeInput('nope')).toBeNull();
  });

  it('filters by kind and size range', () => {
    const list = [
      row('a', 'rust_artifact', 200 * 1024 ** 2),
      row('b', 'node_modules', 50 * 1024 ** 2),
      row('c', 'rust_artifact', 600 * 1024 ** 2),
    ];
    const kinds = uniqueKinds(list);
    expect(kinds).toEqual(['node_modules', 'rust_artifact']);

    const filtered = filterCandidates(list, {
      searchQuery: '',
      riskFilter: 'all',
      kindFilter: 'rust_artifact',
      sizeMinBytes: 100 * 1024 ** 2,
      sizeMaxBytes: 500 * 1024 ** 2,
    });
    expect(filtered.map((c) => c.id)).toEqual(['a']);
  });

  it('matchSizeFilterPreset detects presets', () => {
    const mb = 1024 ** 2;
    expect(matchSizeFilterPreset(100 * mb, 500 * mb)).toBe('range_100_500');
    expect(matchSizeFilterPreset(100 * mb, null)).toBe('min_100mb');
    expect(matchSizeFilterPreset(null, null)).toBe('any');
    expect(matchSizeFilterPreset(50 * mb, null)).toBe('custom');
  });

  it('formatSizeFilterSummary renders readable range', () => {
    const mb = 1024 ** 2;
    expect(formatSizeFilterSummary(100 * mb, 500 * mb)).toBe('100 MB – 500 MB');
    expect(formatSizeFilterSummary(100 * mb, null)).toBe('≥ 100 MB');
  });

  it('search matches path and kind', () => {
    const list = [row('a', 'python_artifact', 1, 'E:\\foo\\venv')];
    const filtered = filterCandidates(list, {
      searchQuery: 'venv',
      riskFilter: 'all',
      kindFilter: 'all',
      sizeMinBytes: null,
      sizeMaxBytes: null,
    });
    expect(filtered).toHaveLength(1);
  });
});
