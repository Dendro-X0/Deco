import { Button } from '@/components/ui/button';
import {
  CANDIDATE_COLLAPSED_LIMIT,
  CANDIDATE_PAGE_SIZE,
} from '@/lib/candidate-list-display';

type Props = {
  total: number;
  expanded: boolean;
  page: number;
  pageCount: number;
  showingFrom: number;
  showingTo: number;
  onExpand: () => void;
  onCollapse: () => void;
  onPageChange: (page: number) => void;
  /** Defaults to item list limits. */
  collapsedLimit?: number;
  pageSize?: number;
  unitLabel?: string;
};

export function CandidateListBanner({
  total,
  expanded,
  page,
  pageCount,
  showingFrom,
  showingTo,
  onExpand,
  onCollapse,
  onPageChange,
  collapsedLimit = CANDIDATE_COLLAPSED_LIMIT,
  pageSize = CANDIDATE_PAGE_SIZE,
  unitLabel = 'items',
}: Props) {
  if (total <= collapsedLimit) return null;

  return (
    <div className="mx-4 mb-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90 space-y-2">
      {!expanded ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            Showing first <strong>{collapsedLimit}</strong> of{' '}
            <strong>{total.toLocaleString()}</strong> {unitLabel} — rendering the full list can slow
            the UI on large scans.
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={onExpand}>
            Show all with pagination
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            Showing {showingFrom}–{showingTo} of {total.toLocaleString()} ({pageSize} per page)
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <span className="font-mono tabular-nums text-[11px]">
              {page} / {pageCount}
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={onCollapse}>
              Collapse
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
