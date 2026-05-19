import { describe, expect, it } from 'vitest';
import { translate } from '../../frontend/src/i18n/catalog';
import {
  canConfirmDirectDelete,
  directDeleteConfirmDescription,
  directDeleteSelectionStats,
} from '../../frontend/src/lib/direct-delete';

const t = (key: string, vars?: Record<string, string | number>) => translate('en', key, vars);
import type { Candidate } from '../../frontend/src/types';

function candidate(id: string, risk: Candidate['risk'], bytes = 0): Candidate {
  return {
    id,
    kind: 'node_modules',
    abs_path: `/tmp/${id}`,
    risk,
    safety_class: 'project_artifact',
    reason_codes: [],
    size_bytes: bytes,
    can_delete: risk !== 'blocked',
  };
}

describe('direct-delete', () => {
  it('counts safe bytes and skips review on confirm', () => {
    const ids = new Set(['a', 'b', 'c']);
    const stats = directDeleteSelectionStats(
      [
        candidate('a', 'safe', 1_000),
        candidate('b', 'review', 500),
        candidate('c', 'blocked'),
      ],
      ids,
    );
    expect(stats.safeCount).toBe(1);
    expect(stats.safeBytes).toBe(1_000);
    expect(stats.reviewCount).toBe(1);
    expect(canConfirmDirectDelete(stats)).toBe(true);
    expect(directDeleteConfirmDescription(t, stats)).toContain('review-tier');
    expect(directDeleteConfirmDescription(t, stats)).toContain('cannot be restored');
  });

  it('blocks confirm when only review selected', () => {
    const stats = directDeleteSelectionStats([candidate('a', 'review')], new Set(['a']));
    expect(canConfirmDirectDelete(stats)).toBe(false);
    expect(directDeleteConfirmDescription(t, stats)).toContain('No safe-tier');
  });
});
