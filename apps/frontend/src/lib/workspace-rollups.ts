import { candidateSizeIsKnown } from './format';
import { groupCandidatesByProject, type ProjectGroup } from './project-grouping';
import type { Candidate, RiskLevel } from '@/types';

export const WORKSPACE_ROLLUP_TOP_N = 12;
export const WORKSPACE_ROLLUP_SHOW_MIN_PROJECTS = 2;
export const WORKSPACE_ROLLUP_SHOW_MIN_CANDIDATES = 4;

export type RiskBucketTotals = {
  count: number;
  bytes: number;
  hasUnknownSize: boolean;
};

export type WorkspaceRollup = {
  key: string;
  projectRoot: string;
  candidateCount: number;
  totalsByRisk: Record<RiskLevel, RiskBucketTotals>;
  /** Sum of known sizes across all candidates in the workspace (each artifact counted once). */
  totalBytes: number;
  hasUnknownSize: boolean;
  worstRisk: RiskLevel;
  kindSummary: string;
  candidateIds: string[];
};

function emptyRiskBucket(): RiskBucketTotals {
  return { count: 0, bytes: 0, hasUnknownSize: false };
}

export function accumulateRiskTotals(candidates: readonly Candidate[]): Record<RiskLevel, RiskBucketTotals> {
  const totals: Record<RiskLevel, RiskBucketTotals> = {
    safe: emptyRiskBucket(),
    review: emptyRiskBucket(),
    blocked: emptyRiskBucket(),
  };
  for (const c of candidates) {
    const bucket = totals[c.risk];
    bucket.count += 1;
    if (candidateSizeIsKnown(c.size_bytes)) {
      bucket.bytes += c.size_bytes;
    } else {
      bucket.hasUnknownSize = true;
    }
  }
  return totals;
}

function rollupFromProjectGroup(group: ProjectGroup): WorkspaceRollup {
  const totalsByRisk = accumulateRiskTotals(group.candidates);
  return {
    key: group.key,
    projectRoot: group.projectRoot,
    candidateCount: group.candidates.length,
    totalsByRisk,
    totalBytes: group.totalBytes,
    hasUnknownSize: group.hasUnknownSize,
    worstRisk: group.worstRisk,
    kindSummary: group.kindSummary,
    candidateIds: group.candidates.map((c) => c.id),
  };
}

/** Group scan candidates by project root with per-risk subtotals (no double-count). */
export function buildWorkspaceRollups(candidates: readonly Candidate[]): WorkspaceRollup[] {
  return groupCandidatesByProject([...candidates])
    .map(rollupFromProjectGroup)
    .sort((a, b) => b.totalBytes - a.totalBytes || b.candidateCount - a.candidateCount);
}

export function shouldShowWorkspaceRollups(candidates: readonly Candidate[]): boolean {
  if (candidates.length < WORKSPACE_ROLLUP_SHOW_MIN_CANDIDATES) return false;
  const rollups = buildWorkspaceRollups(candidates);
  return rollups.length >= WORKSPACE_ROLLUP_SHOW_MIN_PROJECTS;
}

export function sumRollupBytes(rollups: readonly WorkspaceRollup[]): number {
  return rollups.reduce((sum, r) => sum + r.totalBytes, 0);
}

/** Grand total bytes from rollups must match summing each candidate once. */
export function rollupBytesMatchCandidates(
  rollups: readonly WorkspaceRollup[],
  candidates: readonly Candidate[],
): boolean {
  let flat = 0;
  for (const c of candidates) {
    if (candidateSizeIsKnown(c.size_bytes)) flat += c.size_bytes;
  }
  return sumRollupBytes(rollups) === flat;
}

export function reclaimableBytesFromRollups(rollups: readonly WorkspaceRollup[]): number {
  return rollups.reduce(
    (sum, r) => sum + r.totalsByRisk.safe.bytes + r.totalsByRisk.review.bytes,
    0,
  );
}

export function selectedRollupSummary(
  candidates: readonly Candidate[],
  selectedIds: Set<string>,
): { workspaceCount: number; folderCount: number; bytes: number } {
  const byId = new Map(candidates.map((c) => [c.id, c]));
  const rollups = buildWorkspaceRollups(candidates);
  let workspaceCount = 0;
  let folderCount = 0;
  let bytes = 0;
  for (const rollup of rollups) {
    let anyInWorkspace = false;
    for (const id of rollup.candidateIds) {
      if (!selectedIds.has(id)) continue;
      anyInWorkspace = true;
      folderCount += 1;
      const c = byId.get(id);
      if (c && candidateSizeIsKnown(c.size_bytes)) bytes += c.size_bytes;
    }
    if (anyInWorkspace) workspaceCount += 1;
  }
  return { workspaceCount, folderCount, bytes };
}

/** Select or clear all safe, deletable folders in one workspace rollup. */
export function toggleRollupSafeSelection(
  rollup: WorkspaceRollup,
  candidates: readonly Candidate[],
  selectedIds: Set<string>,
): Set<string> {
  const group = groupCandidatesByProject([...candidates]).find((g) => g.key === rollup.key);
  if (!group) return selectedIds;
  const safe = group.candidates.filter((c) => c.risk === 'safe' && c.can_delete !== false);
  if (safe.length === 0) return selectedIds;
  const allSelected = safe.every((c) => selectedIds.has(c.id));
  const next = new Set(selectedIds);
  for (const c of safe) {
    if (allSelected) next.delete(c.id);
    else next.add(c.id);
  }
  return next;
}

export function rollupSafeSelectionState(
  rollup: WorkspaceRollup,
  candidates: readonly Candidate[],
  selectedIds: Set<string>,
): 'all' | 'some' | 'none' {
  const group = groupCandidatesByProject([...candidates]).find((g) => g.key === rollup.key);
  if (!group) return 'none';
  const safe = group.candidates.filter((c) => c.risk === 'safe' && c.can_delete !== false);
  if (safe.length === 0) return 'none';
  const n = safe.filter((c) => selectedIds.has(c.id)).length;
  if (n === 0) return 'none';
  if (n === safe.length) return 'all';
  return 'some';
}
