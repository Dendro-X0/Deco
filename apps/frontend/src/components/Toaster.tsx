import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dismissToast, subscribeToasts, type ToastItem } from '@/lib/toast';

function ToastCard({ item }: { item: ToastItem }) {
  return (
    <div
      className={cn(
        'pointer-events-auto w-[min(22rem,calc(100vw-2rem))] rounded-lg border px-4 py-3 shadow-lg backdrop-blur-md',
        'bg-card/95 text-card-foreground',
        item.variant === 'destructive' && 'border-destructive/40',
        item.variant === 'info' && 'border-primary/30',
      )}
      role="status"
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug">{item.title}</p>
          {item.description ? (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.description}</p>
          ) : null}
        </div>
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label="Dismiss"
          onClick={() => dismissToast(item.id)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function Toaster() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setList), []);

  if (list.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
    >
      {list.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </div>
  );
}
