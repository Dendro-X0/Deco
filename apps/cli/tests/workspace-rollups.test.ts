import { describe, expect, it } from 'vitest';
import {
  accumulateRiskTotals,
  buildWorkspaceRollups,
  reclaimableBytesFromRollups,
  rollupBytesMatchCandidates,
  selectedRollupSummary,
  shouldShowWorkspaceRollups,
  toggleRollupSafeSelection,
} from '../../frontend/src/lib/workspace-rollups';
import type { Candidate } from '../../frontend/src/types';

function cand(partial: Partial<Candidate> & Pick<Candidate, 'id' | 'abs_path' | 'kind'>): Candidate {
  return {
    risk: 'safe',
    can_delete: true,
    ...partial,
  };
}

describe('workspace-rollups', () => {
  it('groups by project with per-risk subtotals', () => {
    const candidates = [
      cand({
        id: '1',
        abs_path: 'G:/mono/app-a/node_modules',
        kind: 'node_modules',
        project_root: 'G:/mono/app-a',
        size_bytes: 100,
      }),
      cand({
        id: '2',
        abs_path: 'G:/mono/app-a/target',
        kind: 'rust_artifact',
        project_root: 'G:/mono/app-a',
        size_bytes: 50,
        risk: 'review',
      }),
      cand({
        id: '3',
        abs_path: 'G:/mono/app-b/node_modules',
        kind: 'node_modules',
        project_root: 'G:/mono/app-b',
        size_bytes: 200,
      }),
    ];
    const rollups = buildWorkspaceRollups(candidates);
    expect(rollups).toHaveLength(2);
    const a = rollups.find((r) => r.projectRoot.endsWith('app-a'));
    expect(a?.totalsByRisk.safe.count).toBe(1);
    expect(a?.totalsByRisk.review.count).toBe(1);
    expect(a?.totalBytes).toBe(150);
    expect(rollupBytesMatchCandidates(rollups, candidates)).toBe(true);
  });

  it('reclaimable sums safe and review only', () => {
    const rollups = buildWorkspaceRollups([
      cand({ id: '1', abs_path: 'G:/a/node_modules', kind: 'node_modules', size_bytes: 100 }),
      cand({
        id: '2',
        abs_path: 'G:/a/.cache',
        kind: 'build_artifact',
        risk: 'blocked',
        size_bytes: 999,
      }),
    ]);
    expect(reclaimableBytesFromRollups(rollups)).toBe(100);
  });

  it('selected summary counts workspaces without double-counting bytes', () => {
    const candidates = [
      cand({ id: '1', abs_path: 'G:/a/node_modules', kind: 'node_modules', size_bytes: 10 }),
      cand({ id: '2', abs_path: 'G:/b/node_modules', kind: 'node_modules', size_bytes: 20 }),
    ];
    const selected = new Set(['1', '2']);
    const summary = selectedRollupSummary(candidates, selected);
    expect(summary.workspaceCount).toBe(2);
    expect(summary.folderCount).toBe(2);
    expect(summary.bytes).toBe(30);
  });

  it('toggleRollupSafeSelection selects only safe folders in workspace', () => {
    const candidates = [
      cand({ id: 's', abs_path: 'G:/p/node_modules', kind: 'node_modules', risk: 'safe' }),
      cand({ id: 'r', abs_path: 'G:/p/.cache', kind: 'build_artifact', risk: 'review' }),
    ];
    const rollups = buildWorkspaceRollups(candidates);
    const next = toggleRollupSafeSelection(rollups[0]!, candidates, new Set());
    expect(next.has('s')).toBe(true);
    expect(next.has('r')).toBe(false);
  });

  it('shouldShowWorkspaceRollups requires multiple projects', () => {
    const one = [cand({ id: '1', abs_path: 'G:/a/node_modules', kind: 'node_modules' })];
    expect(shouldShowWorkspaceRollups(one)).toBe(false);
    const two = [
      ...one,
      cand({ id: '2', abs_path: 'G:/b/node_modules', kind: 'node_modules' }),
      cand({ id: '3', abs_path: 'G:/c/node_modules', kind: 'node_modules' }),
      cand({ id: '4', abs_path: 'G:/d/node_modules', kind: 'node_modules' }),
    ];
    expect(shouldShowWorkspaceRollups(two)).toBe(true);
  });

  it('accumulateRiskTotals tracks unknown sizes', () => {
    const totals = accumulateRiskTotals([
      cand({ id: '1', abs_path: 'x', kind: 'node_modules', size_bytes: undefined }),
    ]);
    expect(totals.safe.hasUnknownSize).toBe(true);
    expect(totals.safe.bytes).toBe(0);
  });
});
