import type { Candidate } from '../types';
import { candidateSizeIsKnown } from './format';

export type RiskFilterValue = 'all' | Candidate['risk'];

export type CandidateFilterState = {
  searchQuery: string;
  riskFilter: RiskFilterValue;
  kindFilter: string;
  sizeMinBytes: number | null;
  sizeMaxBytes: number | null;
};

export const EMPTY_CANDIDATE_FILTERS: CandidateFilterState = {
  searchQuery: '',
  riskFilter: 'all',
  kindFilter: 'all',
  sizeMinBytes: null,
  sizeMaxBytes: null,
};

const SIZE_UNITS: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

/** Parse `100`, `100MB`, `1.5 GB` into bytes; empty/invalid → null. */
export function parseSizeInput(input: string): number | null {
  const raw = input.trim().replace(/\s+/g, '');
  if (!raw) return null;
  const m = /^([\d.]+)(b|kb|mb|gb|tb)?$/i.exec(raw);
  if (!m) return null;
  const value = Number(m[1]);
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = (m[2] ?? 'b').toLowerCase();
  const mult = SIZE_UNITS[unit];
  if (!mult) return null;
  return Math.round(value * mult);
}

export function normalizeKindLabel(kind: string): string {
  return kind.trim().toLowerCase().replace(/-/g, '_');
}

export function uniqueKinds(candidates: readonly Candidate[]): string[] {
  const set = new Set<string>();
  for (const c of candidates) {
    const k = String(c.kind ?? '').trim();
    if (k) set.add(k);
  }
  return [...set].sort((a, b) =>
    normalizeKindLabel(a).localeCompare(normalizeKindLabel(b), undefined, {
      sensitivity: 'base',
      numeric: true,
    }),
  );
}

export function matchesCandidateFilters(
  c: Candidate,
  filters: CandidateFilterState,
): boolean {
  const q = filters.searchQuery.trim().toLowerCase();
  if (q) {
    const path = (c.abs_path ?? '').toLowerCase();
    const kind = String(c.kind ?? '').toLowerCase();
    if (!path.includes(q) && !kind.includes(q)) return false;
  }

  if (filters.riskFilter !== 'all' && c.risk !== filters.riskFilter) {
    return false;
  }

  if (filters.kindFilter !== 'all') {
    if (normalizeKindLabel(String(c.kind ?? '')) !== normalizeKindLabel(filters.kindFilter)) {
      return false;
    }
  }

  const hasSizeBounds =
    filters.sizeMinBytes !== null || filters.sizeMaxBytes !== null;
  if (hasSizeBounds) {
    if (!candidateSizeIsKnown(c.size_bytes)) return false;
    const bytes = c.size_bytes;
    if (filters.sizeMinBytes !== null && bytes < filters.sizeMinBytes) return false;
    if (filters.sizeMaxBytes !== null && bytes > filters.sizeMaxBytes) return false;
  }

  return true;
}

export function filterCandidates(
  candidates: readonly Candidate[],
  filters: CandidateFilterState,
): Candidate[] {
  return candidates.filter((c) => matchesCandidateFilters(c, filters));
}

export function filtersAreActive(filters: CandidateFilterState): boolean {
  return (
    filters.searchQuery.trim() !== '' ||
    filters.riskFilter !== 'all' ||
    filters.kindFilter !== 'all' ||
    filters.sizeMinBytes !== null ||
    filters.sizeMaxBytes !== null
  );
}
