/** Default rows shown before the user expands a very large result set. */
export const CANDIDATE_COLLAPSED_LIMIT = 150;

/** Rows per page after the list is expanded. */
export const CANDIDATE_PAGE_SIZE = 200;

export function shouldCollapseCandidateList(total: number): boolean {
  return total > CANDIDATE_COLLAPSED_LIMIT;
}

export function visibleCandidateSlice<T>(
  items: T[],
  expanded: boolean,
  page: number,
): { visible: T[]; pageCount: number; showingFrom: number; showingTo: number } {
  if (!expanded) {
    const visible = items.slice(0, CANDIDATE_COLLAPSED_LIMIT);
    return {
      visible,
      pageCount: 1,
      showingFrom: items.length === 0 ? 0 : 1,
      showingTo: visible.length,
    };
  }
  const pageCount = Math.max(1, Math.ceil(items.length / CANDIDATE_PAGE_SIZE));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = (safePage - 1) * CANDIDATE_PAGE_SIZE;
  const visible = items.slice(start, start + CANDIDATE_PAGE_SIZE);
  return {
    visible,
    pageCount,
    showingFrom: items.length === 0 ? 0 : start + 1,
    showingTo: start + visible.length,
  };
}
