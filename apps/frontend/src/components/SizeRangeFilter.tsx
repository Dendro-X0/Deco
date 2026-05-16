import { useMemo } from 'react';
import { Ruler } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  SIZE_FILTER_PRESETS,
  formatSizeFilterSummary,
  matchSizeFilterPreset,
  parseSizeInput,
  type SizeFilterPresetId,
} from '@/lib/candidate-filter';

type Props = {
  minInput: string;
  maxInput: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  disabled?: boolean;
};

export function SizeRangeFilter({
  minInput,
  maxInput,
  onMinChange,
  onMaxChange,
  disabled,
}: Props) {
  const minBytes = useMemo(() => parseSizeInput(minInput), [minInput]);
  const maxBytes = useMemo(() => parseSizeInput(maxInput), [maxInput]);
  const activePreset = matchSizeFilterPreset(minBytes, maxBytes);
  const showRangeFields = activePreset !== 'any';
  const summary = formatSizeFilterSummary(minBytes, maxBytes);

  const applyPreset = (id: SizeFilterPresetId) => {
    const preset = SIZE_FILTER_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    onMinChange(preset.minInput);
    onMaxChange(preset.maxInput);
  };

  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center',
        disabled && 'pointer-events-none opacity-50',
      )}
      title={summary ? `Size filter: ${summary}` : 'Filter candidates by folder size'}
    >
      <div className="flex items-center gap-2">
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <Ruler className="h-3 w-3 text-primary/80" aria-hidden />
          Size
        </span>
        <div
          className="flex max-w-full flex-wrap gap-1 rounded-lg border border-border/50 bg-muted/15 p-1"
          role="group"
          aria-label="Size presets"
        >
          {SIZE_FILTER_PRESETS.map((preset) => {
            const active = activePreset === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => applyPreset(preset.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[10px] font-semibold tracking-wide transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  active
                    ? 'bg-primary/15 text-primary shadow-sm ring-1 ring-primary/35'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                )}
              >
                {preset.label}
              </button>
            );
          })}
          {activePreset === 'custom' ? (
            <span className="rounded-md bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold text-amber-500 ring-1 ring-amber-500/30">
              Custom
            </span>
          ) : null}
        </div>
      </div>

      {showRangeFields ? (
        <div
          className={cn(
            'inline-flex h-9 max-w-full items-stretch overflow-hidden rounded-lg border bg-background/40',
            activePreset === 'custom'
              ? 'border-amber-500/35 ring-1 ring-amber-500/20'
              : 'border-border/60 ring-1 ring-border/30 focus-within:ring-2 focus-within:ring-primary/40',
          )}
        >
          <label className="sr-only" htmlFor="size-filter-min">
            Minimum size
          </label>
          <input
            id="size-filter-min"
            disabled={disabled}
            placeholder="Min (e.g. 100MB)"
            autoComplete="off"
            spellCheck={false}
            className="deco-number-input-field w-[6.25rem] min-w-0 bg-transparent px-2.5 text-center text-xs font-mono tabular-nums placeholder:text-muted-foreground/50 focus-visible:outline-none"
            value={minInput}
            onChange={(e) => onMinChange(e.target.value)}
          />
          <span
            className="flex w-6 shrink-0 items-center justify-center border-x border-border/50 text-[10px] font-medium text-muted-foreground/70"
            aria-hidden
          >
            —
          </span>
          <label className="sr-only" htmlFor="size-filter-max">
            Maximum size
          </label>
          <input
            id="size-filter-max"
            disabled={disabled}
            placeholder="Max (optional)"
            autoComplete="off"
            spellCheck={false}
            className="deco-number-input-field w-[6.25rem] min-w-0 bg-transparent px-2.5 text-center text-xs font-mono tabular-nums placeholder:text-muted-foreground/50 focus-visible:outline-none"
            value={maxInput}
            onChange={(e) => onMaxChange(e.target.value)}
          />
        </div>
      ) : null}

      {summary && activePreset !== 'any' ? (
        <span className="text-[10px] font-mono text-primary/90 tabular-nums sm:ml-0">{summary}</span>
      ) : null}
    </div>
  );
}
