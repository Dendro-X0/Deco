import { cn } from '@/lib/utils';

type Props = {
  showWordmark?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

const box = { sm: 'w-7 h-7 rounded-md text-sm', md: 'w-8 h-8 rounded-lg text-base' } as const;
const word = { sm: 'text-base', md: 'text-xl' } as const;

export function DecoLogo({ showWordmark = true, size = 'md', className }: Props) {
  return (
    <div className={cn('flex items-center gap-2.5 shrink-0', className)}>
      <div
        className={cn(
          box[size],
          'bg-primary flex items-center justify-center shadow-lg shadow-primary/25 ring-1 ring-primary/30',
        )}
        aria-hidden
      >
        <span className="text-primary-foreground font-bold italic leading-none select-none">D</span>
      </div>
      {showWordmark && (
        <span className={cn(word[size], 'font-bold tracking-tight text-foreground select-none')}>Deco</span>
      )}
    </div>
  );
}

