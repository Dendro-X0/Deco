import { describe, expect, it } from 'vitest';
import {
  groupCandidatesByProject,
  groupSelectionState,
  inferProjectRootFromPath,
  kindSummaryForGroup,
  listSelectionHeaderState,
  resolveProjectRoot,
  sortProjectGroups,
  visibleProjectGroupSlice,
  PROJECT_GROUP_COLLAPSED_LIMIT,
} from '../../frontend/src/lib/project-grouping';
import type { ProjectGroup } from '../../frontend/src/lib/project-grouping';
import type { Candidate } from '../../frontend/src/types';
import { DEFAULT_SORT } from '../../frontend/src/lib/candidate-sort';

function cand(partial: Partial<Candidate> & Pick<Candidate, 'id' | 'abs_path' | 'kind'>): Candidate {
  return {
    risk: 'safe',
    can_delete: true,
    ...partial,
  };
}

describe('project-grouping', () => {
  it('infers project root from node_modules path', () => {
    expect(inferProjectRootFromPath('G:/repo/my-app/node_modules')).toBe('G:/repo/my-app');
  });

  it('groups candidates by project_root', () => {
    const candidates = [
      cand({
        id: '1',
        abs_path: 'G:/a/node_modules',
        kind: 'node_modules',
        project_root: 'G:/a',
        size_bytes: 100,
      }),
      cand({
        id: '2',
        abs_path: 'G:/a/target',
        kind: 'rust_artifact',
        project_root: 'G:/a',
        size_bytes: 200,
      }),
      cand({
        id: '3',
        abs_path: 'G:/b/node_modules',
        kind: 'node_modules',
        project_root: 'G:/b',
        size_bytes: 50,
      }),
    ];
    const groups = groupCandidatesByProject(candidates);
    expect(groups).toHaveLength(2);
    const a = groups.find((g) => g.projectRoot === 'G:/a');
    expect(a?.candidates).toHaveLength(2);
    expect(a?.totalBytes).toBe(300);
    expect(a?.kindSummary).toContain('node_modules');
  });

  it('falls back to path inference when project_root missing', () => {
    const c = cand({
      id: '1',
      abs_path: 'D:/work/pkg/node_modules',
      kind: 'node_modules',
    });
    expect(resolveProjectRoot(c)).toBe('D:/work/pkg');
  });

  it('summarizes kinds with counts', () => {
    const summary = kindSummaryForGroup([
      cand({ id: '1', abs_path: 'x', kind: 'node_modules' }),
      cand({ id: '2', abs_path: 'y', kind: 'node_modules' }),
      cand({ id: '3', abs_path: 'z', kind: 'rust_artifact' }),
    ]);
    expect(summary).toBe('2× node_modules, rust_artifact');
  });

  it('sorts groups by total size desc by default', () => {
    const groups = groupCandidatesByProject([
      cand({ id: '1', abs_path: 'G:/small/node_modules', kind: 'node_modules', project_root: 'G:/small', size_bytes: 10 }),
      cand({ id: '2', abs_path: 'G:/big/node_modules', kind: 'node_modules', project_root: 'G:/big', size_bytes: 1000 }),
    ]);
    const sorted = sortProjectGroups(groups, DEFAULT_SORT);
    expect(sorted[0]?.projectRoot).toBe('G:/big');
  });

  it('group header is indeterminate when only safe items are auto-selected in a mixed group', () => {
    const group: ProjectGroup = {
      key: 'g',
      projectRoot: 'G:/proj',
      candidates: [
        cand({ id: 's1', abs_path: 'G:/proj/node_modules', kind: 'node_modules', risk: 'safe' }),
        cand({
          id: 'r1',
          abs_path: 'G:/proj/.cache',
          kind: 'build_artifact',
          risk: 'review',
        }),
      ],
      totalBytes: 0,
      hasUnknownSize: false,
      kindSummary: '',
      worstRisk: 'review',
      selectableCount: 2,
    };
    const selected = new Set(['s1']);
    expect(groupSelectionState(group, selected)).toBe('some');
    expect(listSelectionHeaderState(group.candidates, selected)).toBe('indeterminate');
  });

  it('group header shows none for review-only projects', () => {
    const group: ProjectGroup = {
      key: 'g',
      projectRoot: 'G:/restaurant',
      candidates: [
        cand({
          id: 'r1',
          abs_path: 'G:/restaurant/npm-cache',
          kind: 'npm_cache',
          risk: 'review',
        }),
      ],
      totalBytes: 0,
      hasUnknownSize: false,
      kindSummary: '',
      worstRisk: 'review',
      selectableCount: 1,
    };
    expect(groupSelectionState(group, new Set())).toBe('none');
  });

  it('paginates project groups when expanded', () => {
    const groups = Array.from({ length: 120 }, (_, i) => ({
      key: `k${i}`,
      projectRoot: `G:/p${i}`,
      candidates: [],
      totalBytes: 0,
      hasUnknownSize: false,
      kindSummary: '',
      worstRisk: 'safe' as const,
      selectableCount: 0,
    }));
    const collapsed = visibleProjectGroupSlice(groups, false, 1);
    expect(collapsed.visible).toHaveLength(PROJECT_GROUP_COLLAPSED_LIMIT);
    const expanded = visibleProjectGroupSlice(groups, true, 2);
    expect(expanded.pageCount).toBe(3);
  });
});
