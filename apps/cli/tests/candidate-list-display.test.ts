import { describe, expect, it } from 'vitest';
import {
  CANDIDATE_COLLAPSED_LIMIT,
  visibleCandidateSlice,
} from '../../frontend/src/lib/candidate-list-display';

describe('candidate-list-display', () => {
  it('collapses large lists by default', () => {
    const items = Array.from({ length: 500 }, (_, i) => i);
    const { visible, showingTo } = visibleCandidateSlice(items, false, 1);
    expect(visible.length).toBe(CANDIDATE_COLLAPSED_LIMIT);
    expect(showingTo).toBe(CANDIDATE_COLLAPSED_LIMIT);
  });

  it('paginates when expanded', () => {
    const items = Array.from({ length: 450 }, (_, i) => i);
    const page1 = visibleCandidateSlice(items, true, 1);
    const page2 = visibleCandidateSlice(items, true, 2);
    expect(page1.visible.length).toBe(200);
    expect(page2.visible.length).toBe(200);
    expect(page1.pageCount).toBe(3);
  });
});
