import { Loader2, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes, formatDurationMs } from '@/lib/format';
import { formatCleanupLiveLine, type CleanupLiveProgress } from '@/lib/cleanup-statistics';

type Props = {
  visible: boolean;
  message: string;
  detail?: string;
  elapsedMs: number;
  live?: CleanupLiveProgress | null;
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
  live,
  paused = false,
  onPause,
  onResume,
  onCancel,
}: Props) {
  if (!visible) return null;

  const liveLine = live ? formatCleanupLiveLine(live) : null;
  const progressPct =
    live && live.plannedBytes > 0 && live.freedBytes > 0
      ? Math.min(100, Math.round((live.freedBytes / live.plannedBytes) * 100))
      : live && live.totalFolders > 0
        ? Math.min(100, Math.round((live.foldersDone / live.totalFolders) * 100))
        : null;

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

        {liveLine && !paused ? (
          <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2.5 space-y-2">
            <p className="text-sm font-semibold tabular-nums text-primary">{liveLine}</p>
            {progressPct != null ? (
              <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-300"
                  style={{ width: `${Math.max(progressPct, live.foldersDone > 0 ? 4 : 0)}%` }}
                />
              </div>
            ) : null}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Freed</p>
                <p className="font-bold tabular-nums">{formatBytes(live.freedBytes)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Folders</p>
                <p className="font-bold tabular-nums">
                  {live.foldersDone}
                  {live.totalFolders > 0 ? ` / ${live.totalFolders}` : ''}
                </p>
              </div>
            </div>
          </div>
        ) : null}

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
