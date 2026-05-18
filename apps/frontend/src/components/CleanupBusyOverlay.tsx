import { Loader2, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDurationMs } from '@/lib/format';

type Props = {
  visible: boolean;
  message: string;
  detail?: string;
  elapsedMs: number;
  paused?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onCancel?: () => void;
};

/** Blocks pointer input while cleanup runs on a background thread; shows timer + context. */
export function CleanupBusyOverlay({
  visible,
  message,
  detail,
  elapsedMs,
  paused = false,
  onPause,
  onResume,
  onCancel,
}: Props) {
  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[35] flex items-center justify-center bg-background/50 backdrop-blur-[2px] pointer-events-auto"
      role="status"
      aria-live="polite"
      aria-busy={!paused}
    >
      <div className="mx-4 w-full max-w-md rounded-xl border border-border/60 bg-card/95 px-5 py-4 shadow-lg space-y-3">
        <div className="flex items-start gap-3">
          {paused ? (
            <Pause size={22} className="shrink-0 text-amber-500 mt-0.5" aria-hidden />
          ) : (
            <Loader2 size={22} className="shrink-0 animate-spin text-primary mt-0.5" />
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {paused ? 'Cleanup paused' : message}
            </p>
            {paused ? (
              <p className="text-xs text-muted-foreground leading-relaxed">
                Resume when ready, or stop to cancel. The disk can finish pending I/O before the next
                folder.
              </p>
            ) : detail ? (
              <p className="text-xs text-muted-foreground leading-relaxed">{detail}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-border/50 pt-2 text-xs gap-3">
          <span className="text-muted-foreground">Elapsed</span>
          <span className="font-mono font-semibold tabular-nums text-primary">
            {formatDurationMs(Math.max(0, elapsedMs))}
          </span>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {paused
            ? onResume && (
                <Button type="button" variant="default" size="sm" className="flex-1" onClick={onResume}>
                  Resume
                </Button>
              )
            : onPause && (
                <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onPause}>
                  Pause
                </Button>
              )}
          {onCancel ? (
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={onCancel}>
              Stop cleanup
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
