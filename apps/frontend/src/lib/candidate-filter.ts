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
export type SizeFilterPresetId =
  | 'any'
  | 'min_10mb'
  | 'min_100mb'
  | 'min_500mb'
  | 'min_1gb'
  | 'range_100_500'
  | 'custom';

export type SizeFilterPreset = {
  id: SizeFilterPresetId;
  label: string;
  minInput: string;
  maxInput: string;
  minBytes: number | null;
  maxBytes: number | null;
};

const MB = 1024 ** 2;
const GB = 1024 ** 3;

/** Quick size presets for the results list filter bar. */
export const SIZE_FILTER_PRESETS: readonly SizeFilterPreset[] = [
  { id: 'any', label: 'Any', minInput: '', maxInput: '', minBytes: null, maxBytes: null },
  { id: 'min_10mb', label: '≥10 MB', minInput: '10MB', maxInput: '', minBytes: 10 * MB, maxBytes: null },
  { id: 'min_100mb', label: '≥100 MB', minInput: '100MB', maxInput: '', minBytes: 100 * MB, maxBytes: null },
  { id: 'min_500mb', label: '≥500 MB', minInput: '500MB', maxInput: '', minBytes: 500 * MB, maxBytes: null },
  { id: 'min_1gb', label: '≥1 GB', minInput: '1GB', maxInput: '', minBytes: GB, maxBytes: null },
  {
    id: 'range_100_500',
    label: '100–500 MB',
    minInput: '100MB',
    maxInput: '500MB',
    minBytes: 100 * MB,
    maxBytes: 500 * MB,
  },
] as const;

export function matchSizeFilterPreset(
  minBytes: number | null,
  maxBytes: number | null,
): SizeFilterPresetId {
  for (const preset of SIZE_FILTER_PRESETS) {
    if (preset.minBytes === minBytes && preset.maxBytes === maxBytes) {
      return preset.id;
    }
  }
  if (minBytes === null && maxBytes === null) return 'any';
  return 'custom';
}

export function formatSizeFilterSummary(
  minBytes: number | null,
  maxBytes: number | null,
): string | null {
  if (minBytes === null && maxBytes === null) return null;
  const fmt = (n: number) => {
    if (n >= GB) return `${(n / GB).toFixed(n % GB === 0 ? 0 : 1)} GB`;
    if (n >= MB) return `${Math.round(n / MB)} MB`;
    if (n >= 1024) return `${Math.round(n / 1024)} KB`;
    return `${n} B`;
  };
  if (minBytes != null && maxBytes != null) return `${fmt(minBytes)} – ${fmt(maxBytes)}`;
  if (minBytes != null) return `≥ ${fmt(minBytes)}`;
  if (maxBytes != null) return `≤ ${fmt(maxBytes)}`;
  return null;
}

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
