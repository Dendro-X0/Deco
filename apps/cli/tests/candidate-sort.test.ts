import { describe, expect, it } from 'vitest';
import type { Candidate } from '../../frontend/src/types';
import {
  compareCandidatesSorted,
  DEFAULT_SORT,
  toggleSortColumn,
} from '../../frontend/src/lib/candidate-sort';

function row(id: string, kind: string, size: number): Candidate {
  return {
    id,
    abs_path: `E:\\proj\\${id}`,
    kind,
    risk: 'safe',
    size_bytes: size,
  };
}

describe('candidate-sort', () => {
  it('sorts by active column only', () => {
    const a = row('a', 'AAA', 200);
    const b = row('b', 'ZZZ', 100);
    expect(compareCandidatesSorted(a, b, { column: 'size', dir: 'desc' })).toBeLessThan(0);
    expect(compareCandidatesSorted(a, b, { column: 'kind', dir: 'asc' })).toBeLessThan(0);
  });

  it('toggleSortColumn switches column or flips direction', () => {
    expect(toggleSortColumn(DEFAULT_SORT, 'kind')).toEqual({
      column: 'kind',
      dir: 'asc',
    });
    expect(toggleSortColumn({ column: 'size', dir: 'desc' }, 'size')).toEqual({
      column: 'size',
      dir: 'asc',
    });
  });
});
