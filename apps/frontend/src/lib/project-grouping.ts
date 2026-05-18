import type { Candidate, RiskLevel } from '../types';
import { candidateSizeIsKnown } from './format';
import type { CandidateSortState } from './candidate-sort';
import { compareCandidates } from './candidate-sort';

/** Auto-enable grouped view when the filtered list exceeds this count. */
export const GROUP_BY_PROJECT_DEFAULT_THRESHOLD = 80;

/** Project groups shown before the user expands the list. */
export const PROJECT_GROUP_COLLAPSED_LIMIT = 100;

/** Project groups per page after expand. */
export const PROJECT_GROUP_PAGE_SIZE = 50;

const ARTIFACT_DIR_NAMES = new Set([
  'node_modules',
  'target',
  '.pnpm-store',
  'pnpm-store',
  '.git',
  '.next',
  '.svelte-kit',
  '.astro',
  '.cache',
  'dist',
  'build',
  'dist-firefox',
  '.cargo-target',
  'pkg',
  'vendor',
  '__pycache__',
  '.pytest_cache',
  '.mypy_cache',
  '.ruff_cache',
  '.tox',
  'venv',
  '.venv',
  'obj',
]);

const RISK_RANK: Record<RiskLevel, number> = {
  blocked: 0,
  review: 1,
  safe: 2,
};

export type ProjectGroup = {
  key: string;
  projectRoot: string;
  candidates: Candidate[];
  totalBytes: number;
  hasUnknownSize: boolean;
  kindSummary: string;
  worstRisk: RiskLevel;
  selectableCount: number;
};

export function normalizePathKey(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

/** Prefer classifier `project_root`; otherwise infer parent project folder from artifact path. */
export function resolveProjectRoot(candidate: Candidate): string {
  const explicit = candidate.project_root?.trim();
  if (explicit) return explicit.replace(/\\/g, '/').replace(/\/+$/, '');
  return inferProjectRootFromPath(candidate.abs_path);
}

export function inferProjectRootFromPath(absPath: string): string {
  const normalized = absPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return normalized;
  const leaf = parts[parts.length - 1]!.toLowerCase();
  if (ARTIFACT_DIR_NAMES.has(leaf) && parts.length > 1) {
    return parts.slice(0, -1).join('/');
  }
  if (parts.length === 1) return normalized;
  return parts.slice(0, -1).join('/');
}

export function worstRiskInGroup(candidates: Candidate[]): RiskLevel {
  let worst: RiskLevel = 'safe';
  for (const c of candidates) {
    if (RISK_RANK[c.risk] < RISK_RANK[worst]) worst = c.risk;
  }
  return worst;
}

export function kindSummaryForGroup(candidates: Candidate[]): string {
  const counts = new Map<string, number>();
  for (const c of candidates) {
    counts.set(c.kind, (counts.get(c.kind) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([kind, count]) => (count > 1 ? `${count}× ${kind}` : kind))
    .join(', ');
}

export function groupCandidatesByProject(candidates: Candidate[]): ProjectGroup[] {
  const buckets = new Map<string, { root: string; items: Candidate[] }>();
  for (const c of candidates) {
    const root = resolveProjectRoot(c);
    const key = normalizePathKey(root);
    const bucket = buckets.get(key);
    if (bucket) bucket.items.push(c);
    else buckets.set(key, { root, items: [c] });
  }

  const groups: ProjectGroup[] = [];
  for (const [key, { root, items }] of buckets) {
    let totalBytes = 0;
    let hasUnknownSize = false;
    for (const c of items) {
      if (candidateSizeIsKnown(c.size_bytes)) totalBytes += c.size_bytes;
      else hasUnknownSize = true;
    }
    groups.push({
      key,
      projectRoot: root,
      candidates: items,
      totalBytes,
      hasUnknownSize,
      kindSummary: kindSummaryForGroup(items),
      worstRisk: worstRiskInGroup(items),
      selectableCount: items.filter((c) => c.risk !== 'blocked' && c.can_delete !== false).length,
    });
  }
  return groups;
}

export function sortProjectGroups(groups: ProjectGroup[], sort: CandidateSortState): ProjectGroup[] {
  const sorted = [...groups];
  sorted.sort((a, b) => compareProjectGroups(a, b, sort));
  for (const g of sorted) {
    g.candidates.sort((x, y) => compareCandidates(x, y, sort.column, sort.dir));
  }
  return sorted;
}

export function compareProjectGroups(
  a: ProjectGroup,
  b: ProjectGroup,
  sort: CandidateSortState,
): number {
  const ascending = sort.dir === 'asc';
  switch (sort.column) {
    case 'size': {
      if (a.hasUnknownSize !== b.hasUnknownSize) return a.hasUnknownSize ? 1 : -1;
      if (a.totalBytes !== b.totalBytes) {
        return ascending ? a.totalBytes - b.totalBytes : b.totalBytes - a.totalBytes;
      }
      break;
    }
    case 'kind': {
      const cmp = a.kindSummary.localeCompare(b.kindSummary, undefined, { sensitivity: 'base' });
      if (cmp !== 0) return ascending ? cmp : -cmp;
      break;
    }
    case 'risk': {
      const av = RISK_RANK[a.worstRisk];
      const bv = RISK_RANK[b.worstRisk];
      if (av !== bv) return ascending ? av - bv : bv - av;
      break;
    }
    case 'path':
    default: {
      const cmp = a.projectRoot.localeCompare(b.projectRoot, undefined, {
        sensitivity: 'base',
        numeric: true,
      });
      if (cmp !== 0) return ascending ? cmp : -cmp;
      break;
    }
  }
  return a.projectRoot.localeCompare(b.projectRoot, undefined, { numeric: true });
}

export function visibleProjectGroupSlice(
  groups: ProjectGroup[],
  expanded: boolean,
  page: number,
): { visible: ProjectGroup[]; pageCount: number; showingFrom: number; showingTo: number } {
  if (!expanded) {
    const visible = groups.slice(0, PROJECT_GROUP_COLLAPSED_LIMIT);
    return {
      visible,
      pageCount: 1,
      showingFrom: groups.length === 0 ? 0 : 1,
      showingTo: visible.length,
    };
  }
  const pageCount = Math.max(1, Math.ceil(groups.length / PROJECT_GROUP_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * PROJECT_GROUP_PAGE_SIZE;
  const visible = groups.slice(start, start + PROJECT_GROUP_PAGE_SIZE);
  return {
    visible,
    pageCount,
    showingFrom: groups.length === 0 ? 0 : start + 1,
    showingTo: start + visible.length,
  };
}

export type GroupSelectionState = 'all' | 'some' | 'none';

function selectableInGroup(group: ProjectGroup): Candidate[] {
  return group.candidates.filter((c) => c.risk !== 'blocked' && c.can_delete !== false);
}

/** Checkbox state for a project group row (header). */
export function groupSelectionState(
  group: ProjectGroup,
  selectedIds: Set<string>,
): GroupSelectionState {
  const selectable = selectableInGroup(group);
  if (selectable.length === 0) return 'none';

  const selected = selectable.filter((c) => selectedIds.has(c.id));
  if (selected.length === 0) return 'none';
  if (selected.length === selectable.length) return 'all';
  return 'some';
}

/** Header "select all" checkbox in flat candidate list. */
export function listSelectionHeaderState(
  candidates: Candidate[],
  selectedIds: Set<string>,
): boolean | 'indeterminate' {
  const selectable = candidates.filter((c) => c.risk !== 'blocked' && c.can_delete !== false);
  if (selectable.length === 0) return false;
  const selectedCount = selectable.filter((c) => selectedIds.has(c.id)).length;
  if (selectedCount === 0) return false;
  if (selectedCount === selectable.length) return true;
  return 'indeterminate';
}

export function toggleGroupSelection(
  group: ProjectGroup,
  selectedIds: Set<string>,
  select: boolean,
): Set<string> {
  const next = new Set(selectedIds);
  for (const c of group.candidates) {
    if (c.risk === 'blocked' || c.can_delete === false) continue;
    if (select) next.add(c.id);
    else next.delete(c.id);
  }
  return next;
}
