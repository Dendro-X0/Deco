import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { TableHead } from '@/components/ui/table';
import type { CandidateSortColumn, CandidateSortState } from '@/lib/candidate-sort';
import { cn } from '@/lib/utils';

type Props = {
  column: CandidateSortColumn;
  sort: CandidateSortState;
  onToggleSort: (column: CandidateSortColumn) => void;
  children: ReactNode;
  className?: string;
  alignEnd?: boolean;
};

export function CandidateSortHeading({
  column,
  sort,
  onToggleSort,
  children,
  className,
  alignEnd,
}: Props) {
  const active = sort.column === column;
  const dir = active ? sort.dir : null;
  return (
    <TableHead className={className}>
      <button
        type="button"
        title={active ? 'Click to reverse sort direction' : 'Click to sort by this column'}
        onClick={() => onToggleSort(column)}
        className={cn(
          'inline-flex items-center gap-1.5 font-semibold tracking-tight text-foreground hover:text-primary transition-colors select-none rounded-sm leading-tight focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
          alignEnd && 'w-full justify-end',
          active && 'text-primary',
        )}
      >
        <span>{children}</span>
        {active && dir ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3.5 w-3.5 shrink-0 opacity-70" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 shrink-0 opacity-70" />
          )
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40" />
        )}
      </button>
    </TableHead>
  );
}
