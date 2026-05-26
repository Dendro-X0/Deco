import { Loader2 } from 'lucide-react';
import { formatDurationMs } from '@/lib/format';

type Props = {
  visible: boolean;
  title: string;
  detail?: string;
  elapsedMs?: number;
};

/** Full-window blocker: absorbs pointer events while a long backend operation runs. */
export function OperationBusyOverlay({ visible, title, detail, elapsedMs }: Props) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[45] flex items-center justify-center bg-background/55 backdrop-blur-[2px] pointer-events-auto cursor-wait"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="operation-busy-title"
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-border/60 bg-card/95 px-5 py-4 shadow-lg space-y-3 pointer-events-auto">
        <div className="flex items-start gap-3">
          <Loader2 size={22} className="shrink-0 animate-spin text-primary mt-0.5" aria-hidden />
          <div className="min-w-0 flex-1 space-y-1">
            <p id="operation-busy-title" className="text-sm font-semibold text-foreground leading-snug">
              {title}
            </p>
            {detail ? (
              <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
            ) : null}
          </div>
        </div>
        {elapsedMs != null && elapsedMs > 0 ? (
          <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs">
            <span className="text-muted-foreground">Elapsed</span>
            <span className="font-mono font-semibold tabular-nums text-primary">
              {formatDurationMs(elapsedMs)}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
