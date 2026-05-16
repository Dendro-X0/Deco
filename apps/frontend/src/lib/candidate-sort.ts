import type { Candidate, RiskLevel } from '../types';

export type CandidateSortColumn = 'size' | 'kind' | 'risk' | 'path';
export type SortDirection = 'asc' | 'desc';

const RISK_RANK: Record<RiskLevel, number> = {
  blocked: 0,
  review: 1,
  safe: 2,
};

function sizePending(c: Candidate): boolean {
  return c.size_bytes === undefined;
}

/** Compare candidates for dashboard table sorting. Unknown sizes sort last so “Sizing…” stays at the bottom. */
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
      break;
    }
    case 'kind': {
      const cmp = String(a.kind).localeCompare(String(b.kind), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmp !== 0) return ascending ? cmp : -cmp;
      break;
    }
    case 'risk': {
      const av = RISK_RANK[a.risk] ?? 99;
      const bv = RISK_RANK[b.risk] ?? 99;
      if (av !== bv) return ascending ? av - bv : bv - av;
      break;
    }
    case 'path': {
      const cmp = String(a.abs_path).localeCompare(String(b.abs_path), undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmp !== 0) return ascending ? cmp : -cmp;
      break;
    }
    default:
      break;
  }
  return String(a.id).localeCompare(String(b.id));
}
