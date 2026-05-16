import * as React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type NumberInputProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'onValueChange'
> & {
  value: number;
  onValueChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
};

function clampValue(value: number, min?: number, max?: number): number {
  let v = value;
  if (!Number.isFinite(v)) v = min ?? 0;
  if (min != null) v = Math.max(min, v);
  if (max != null) v = Math.min(max, v);
  return v;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      value,
      onValueChange,
      min,
      max,
      step = 1,
      className,
      disabled,
      id,
      'aria-label': ariaLabel,
      ...props
    },
    ref,
  ) => {
    const bump = (delta: number) => {
      if (disabled) return;
      onValueChange(clampValue(value + delta, min, max));
    };

    return (
      <div
        className={cn(
          'flex h-10 w-full overflow-hidden rounded-md border border-input bg-background/50',
          'ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'cursor-not-allowed opacity-50',
          className,
        )}
      >
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            'deco-number-input-field flex-1 min-w-0 bg-transparent px-3 py-2 text-sm tabular-nums',
            'placeholder:text-muted-foreground focus-visible:outline-none',
            'disabled:cursor-not-allowed',
          )}
          value={Number.isFinite(value) ? String(value) : ''}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw === '') {
              onValueChange(min ?? 0);
              return;
            }
            const parsed = Number(raw);
            if (!Number.isFinite(parsed)) return;
            onValueChange(clampValue(parsed, min, max));
          }}
          {...props}
        />
        <div
          className="flex flex-col shrink-0 border-l border-border/60"
          role="group"
          aria-label={ariaLabel ? `${ariaLabel} step` : 'Adjust value'}
        >
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || (max != null && value >= max)}
            onClick={() => bump(step)}
            className={cn(
              'flex flex-1 items-center justify-center px-2 min-h-[1.125rem]',
              'text-muted-foreground hover:text-primary hover:bg-primary/10',
              'transition-colors disabled:opacity-40 disabled:pointer-events-none',
            )}
            aria-label="Increase"
          >
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled || (min != null && value <= min)}
            onClick={() => bump(-step)}
            className={cn(
              'flex flex-1 items-center justify-center px-2 min-h-[1.125rem] border-t border-border/60',
              'text-muted-foreground hover:text-primary hover:bg-primary/10',
              'transition-colors disabled:opacity-40 disabled:pointer-events-none',
            )}
            aria-label="Decrease"
          >
            <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    );
  },
);
NumberInput.displayName = 'NumberInput';
