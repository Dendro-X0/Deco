import { useMemo } from 'react';
import { Loader2, Play } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { APP_VERSION } from '@/lib/app-version';
import { formatDurationMs } from '@/lib/format';
import { useI18n } from '@/i18n';
import type { ScanProgress } from '@/lib/scan-progress';
import { phaseTimingTotalMs, type ScanPhaseTimings } from '@/lib/scan-statistics';
import { cn } from '@/lib/utils';

type Props = {
  progress: ScanProgress;
  scanning: boolean;
  busy: boolean;
  elapsedMs: number;
  phaseTimings?: ScanPhaseTimings | null;
};

export function StatusFooter({ progress, scanning, busy, elapsedMs, phaseTimings }: Props) {
  const { t } = useI18n();
  const active = scanning || busy;
  const phaseLabel = progress.phase ? t(`status.phase.${progress.phase}`) : null;
  const showElapsed = active && elapsedMs > 0;
  const showPhaseTimings =
    !active && phaseTimings != null && phaseTimingTotalMs(phaseTimings) > 0;

  const phaseTimingLine = useMemo(() => {
    if (!phaseTimings) return null;
    const fmt = (ms: number) =>
      ms >= 1000 ? formatDurationMs(ms) : `${Math.round(ms)}ms`;
    return t('dashboard.scanStats.phaseTimingLine', {
      discover: fmt(phaseTimings.discoverMs),
      classify: fmt(phaseTimings.classifyMs),
      size: fmt(phaseTimings.sizeMs),
    });
  }, [phaseTimings, t]);

  return (
    <footer className="flex h-14 shrink-0 items-center gap-4 border-t bg-background/80 px-6 backdrop-blur-md">
      <div className="flex min-w-0 max-w-[40%] flex-col gap-0.5">
        <div className="flex items-center gap-2">
          {active ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" aria-hidden />
          ) : (
            <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          )}
          {phaseLabel ? (
            <span className="shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
              {phaseLabel}
            </span>
          ) : null}
        </div>
        <span
          className="truncate text-[10px] font-medium leading-snug text-muted-foreground"
          title={progress.detail ? `${progress.text}\n${progress.detail}` : progress.text}
        >
          {progress.text}
        </span>
        {progress.detail && active ? (
          <span className="line-clamp-2 text-[9px] leading-snug text-muted-foreground/80" title={progress.detail}>
            {progress.detail}
          </span>
        ) : null}
        {showPhaseTimings && phaseTimingLine ? (
          <span
            className="truncate text-[9px] leading-snug text-muted-foreground/90"
            title={phaseTimingLine}
          >
            {phaseTimingLine}
          </span>
        ) : null}
      </div>

      <div className="relative min-w-0 flex-1">
        <Progress
          value={progress.percent}
          className={cn('h-2 overflow-hidden', active && 'shimmer-progress')}
        />
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {showElapsed ? (
          <span
            className="text-xs font-mono font-semibold tabular-nums text-primary"
            title="Elapsed time"
          >
            {formatDurationMs(elapsedMs)}
          </span>
        ) : null}
        <span className="min-w-[2.5rem] text-right text-xs font-mono font-bold tabular-nums tracking-tight">
          {progress.percent.toFixed(0)}%
        </span>
        <span
          className="hidden text-[10px] font-mono text-muted-foreground/60 sm:inline"
          title={t('statusFooter.decoVersion')}
        >
          v{APP_VERSION}
        </span>
      </div>
    </footer>
  );
}
