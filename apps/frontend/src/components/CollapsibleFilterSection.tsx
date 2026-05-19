import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
};

/** Filter block: always visible on md+, collapsible toggle on narrow viewports. */
export function CollapsibleFilterSection({ label, children, active, className }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border/40 bg-background/40 p-3',
        className,
      )}
    >
      <button
        type="button"
        className="md:hidden flex w-full items-center justify-between gap-2 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
          {label}
          {active ? (
            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
          ) : null}
        </span>
        <ChevronDown
          size={16}
          className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>
      <p className="hidden md:block text-[10px] font-black uppercase text-muted-foreground tracking-widest">
        {label}
        {active ? (
          <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
        ) : null}
      </p>
      <div className={cn('flex flex-col gap-3', !open && 'hidden md:flex')}>{children}</div>
    </div>
  );
}
