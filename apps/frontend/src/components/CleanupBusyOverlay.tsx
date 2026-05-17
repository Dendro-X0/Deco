import { Loader2 } from 'lucide-react';
import { formatDurationMs } from '@/lib/format';

type Props = {
  visible: boolean;
  message: string;
  detail?: string;
  elapsedMs: number;
};

/** Blocks pointer input while cleanup runs on a background thread; shows timer + context. */
export function CleanupBusyOverlay({ visible, message, detail, elapsedMs }: Props) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[35] flex items-center justify-center bg-background/50 backdrop-blur-[2px] pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-border/60 bg-card/95 px-5 py-4 shadow-lg space-y-3">
        <div className="flex items-start gap-3">
          <Loader2 size={22} className="shrink-0 animate-spin text-primary mt-0.5" />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-foreground leading-snug">{message}</p>
            {detail ? (
              <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
          <span className="text-muted-foreground">Elapsed</span>
          <span className="font-mono font-semibold tabular-nums text-primary">
            {elapsedMs > 0 ? formatDurationMs(elapsedMs) : '0s'}
          </span>
        </div>
      </div>
    </div>
  );
}
