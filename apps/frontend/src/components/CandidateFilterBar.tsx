import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SizeRangeFilter } from '@/components/SizeRangeFilter';
import { cn } from '@/lib/utils';

type Props = {
  riskFilter: string;
  onRiskFilterChange: (value: string) => void;
  kindFilter: string;
  onKindFilterChange: (value: string) => void;
  availableKinds: string[];
  sizeMinInput: string;
  sizeMaxInput: string;
  onSizeMinChange: (value: string) => void;
  onSizeMaxChange: (value: string) => void;
  filtersActive: boolean;
  onClearFilters: () => void;
  sizeFilterDisabled?: boolean;
  className?: string;
};

export function CandidateFilterBar({
  riskFilter,
  onRiskFilterChange,
  kindFilter,
  onKindFilterChange,
  availableKinds,
  sizeMinInput,
  sizeMaxInput,
  onSizeMinChange,
  onSizeMaxChange,
  filtersActive,
  onClearFilters,
  sizeFilterDisabled,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'rounded-lg border border-border/40 bg-muted/10 p-3 space-y-3',
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Filter className="h-3 w-3 text-primary/80" aria-hidden />
          Filters
        </span>
        {filtersActive ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[10px] font-semibold uppercase tracking-wide"
            onClick={onClearFilters}
          >
            Clear all
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={riskFilter} onValueChange={onRiskFilterChange}>
          <SelectTrigger className="h-9 w-[130px] bg-background/50 text-xs">
            <SelectValue placeholder="Risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All risks</SelectItem>
            <SelectItem value="safe">Safe</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={kindFilter}
          onValueChange={onKindFilterChange}
          disabled={availableKinds.length === 0}
        >
          <SelectTrigger className="h-9 w-[11rem] bg-background/50 text-xs">
            <SelectValue placeholder="All kinds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            {availableKinds.map((k) => (
              <SelectItem key={k} value={k} className="font-mono text-xs uppercase">
                {k}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SizeRangeFilter
        minInput={sizeMinInput}
        maxInput={sizeMaxInput}
        onMinChange={onSizeMinChange}
        onMaxChange={onSizeMaxChange}
        disabled={sizeFilterDisabled}
      />
    </div>
  );
}
