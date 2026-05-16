import type { Candidate, RiskLevel } from '../types';

export type CandidateSortColumn = 'size' | 'kind' | 'risk' | 'path';
export type SortDirection = 'asc' | 'desc';

export type CandidateSortState = {
  column: CandidateSortColumn;
  dir: SortDirection;
};

export const DEFAULT_SORT: CandidateSortState = { column: 'size', dir: 'desc' };

const RISK_RANK: Record<RiskLevel, number> = {
  blocked: 0,
  review: 1,
  safe: 2,
};

function sizePending(c: Candidate): boolean {
  return c.size_bytes === undefined;
}

export function compareCandidates(
  a: Candidate,
  b: Candidate,
  column: CandidateSortColumn,
  dir: SortDirection,
): number {
  const ascending = dir === 'asc';

  switch (column) {
    case 'size': {
      const aP = sizePending(a);
      const bP = sizePending(b);
      if (aP !== bP) return aP ? 1 : -1;
      const av = a.size_bytes ?? 0;
      const bv = b.size_bytes ?? 0;
      if (av !== bv) return ascending ? av - bv : bv - av;
      return 0;
    }
    case 'kind': {
      const cmp = String(a.kind).localeCompare(String(b.kind), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmp !== 0) return ascending ? cmp : -cmp;
      return 0;
    }
    case 'risk': {
      const av = RISK_RANK[a.risk] ?? 99;
      const bv = RISK_RANK[b.risk] ?? 99;
      if (av !== bv) return ascending ? av - bv : bv - av;
      return 0;
    }
    case 'path': {
      const cmp = String(a.abs_path).localeCompare(String(b.abs_path), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmp !== 0) return ascending ? cmp : -cmp;
      return 0;
    }
    default:
      return 0;
  }
}

export function compareCandidatesSorted(
  a: Candidate,
  b: Candidate,
  sort: CandidateSortState = DEFAULT_SORT,
): number {
  const cmp = compareCandidates(a, b, sort.column, sort.dir);
  if (cmp !== 0) return cmp;
  return String(a.id).localeCompare(String(b.id));
}

export function defaultDirForColumn(column: CandidateSortColumn): SortDirection {
  return column === 'size' ? 'desc' : 'asc';
}

/** Click active column → flip direction; click another → sort by that column. */
export function toggleSortColumn(
  current: CandidateSortState,
  column: CandidateSortColumn,
): CandidateSortState {
  if (current.column === column) {
    return { column, dir: current.dir === 'asc' ? 'desc' : 'asc' };
  }
  return { column, dir: defaultDirForColumn(column) };
}
