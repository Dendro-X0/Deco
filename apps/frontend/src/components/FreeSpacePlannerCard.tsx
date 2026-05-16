import { useMemo } from 'react';
import { HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NumberInput } from '@/components/ui/number-input';
import { DisabledActionHint } from '@/components/DisabledActionHint';
import { formatBytes } from '@/lib/format';
import type { ScanReport } from '@/types';
import { cn } from '@/lib/utils';

const GB = 1024 ** 3;

type Props = {
  summary: ScanReport | null;
  plannerGb: number;
  onPlannerGbChange: (gb: number) => void;
  plannerMessage: string | null;
  onPlanSafe: () => void;
  onPlanReview: () => void;
  cleanDisabledReason: string | null;
  onPreview: () => void;
  disabled?: boolean;
};

export function FreeSpacePlannerCard({
  summary,
  plannerGb,
  onPlannerGbChange,
  plannerMessage,
  onPlanSafe,
  onPlanReview,
  cleanDisabledReason,
  onPreview,
  disabled,
}: Props) {
  const safeBytes = summary?.totals_by_risk?.safe?.bytes ?? 0;
  const reviewBytes = summary?.totals_by_risk?.review?.bytes ?? 0;
  const totalReclaimBytes = safeBytes + reviewBytes;

  const { maxGb, safePct, reviewPct, targetPct } = useMemo(() => {
    const safeGb = safeBytes / GB;
    const reviewGb = reviewBytes / GB;
    const max = Math.max(10, Math.ceil(safeGb + reviewGb), plannerGb);
    return {
      maxGb: max,
      safePct: max > 0 ? (safeGb / max) * 100 : 0,
      reviewPct: max > 0 ? (reviewGb / max) * 100 : 0,
      targetPct: max > 0 ? Math.min(100, (plannerGb / max) * 100) : 0,
    };
  }, [safeBytes, reviewBytes, plannerGb]);

  const hasScan = Boolean(summary?.scan_id);

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <HardDrive size={14} /> Free Space Planner
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasScan ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Run a scan to see how much space you can reclaim, then set a target and auto-select
            candidates.
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>Reclaimable from scan</span>
                <span className="font-mono tabular-nums text-foreground">
                  {formatBytes(totalReclaimBytes)}
                </span>
              </div>
              <div className="relative h-3 overflow-hidden rounded-full bg-muted/40">
                <div
                  className="absolute inset-y-0 left-0 bg-primary/55"
                  style={{ width: `${safePct}%` }}
                />
                <div
                  className="absolute inset-y-0 bg-amber-500/45"
                  style={{ left: `${safePct}%`, width: `${reviewPct}%` }}
                />
                <div
                  className="absolute inset-y-0 w-0.5 bg-foreground shadow-[0_0_6px_rgba(255,255,255,0.5)]"
                  style={{ left: `calc(${targetPct}% - 1px)` }}
                  title={`Target: ${plannerGb} GB`}
                />
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary/70" />
                  Safe {formatBytes(safeBytes)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500/70" />
                  Review {formatBytes(reviewBytes)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">
                Target to free (GB)
              </label>
              <input
                type="range"
                min={1}
                max={maxGb}
                step={1}
                disabled={disabled}
                value={Math.min(plannerGb, maxGb)}
                onChange={(e) => onPlannerGbChange(Number(e.target.value))}
                className={cn('deco-range w-full', disabled && 'pointer-events-none opacity-50')}
                aria-label="Target gigabytes slider"
              />
              <NumberInput
                min={1}
                max={maxGb}
                step={1}
                value={plannerGb}
                onValueChange={onPlannerGbChange}
                disabled={disabled}
                aria-label="Target to free in gigabytes"
              />
            </div>
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="h-9 text-xs"
            disabled={disabled || !hasScan}
            onClick={onPlanSafe}
          >
            Plan safe
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 text-xs"
            disabled={disabled || !hasScan}
            onClick={onPlanReview}
          >
            Incl. review
          </Button>
        </div>

        {plannerMessage ? (
          <p className="text-xs leading-relaxed text-muted-foreground">{plannerMessage}</p>
        ) : null}

        <DisabledActionHint reason={cleanDisabledReason}>
          <Button
            className="h-10 w-full border border-primary/30 bg-primary/20 font-bold text-primary hover:bg-primary/30"
            disabled={cleanDisabledReason !== null}
            onClick={onPreview}
          >
            Preview cleanup
          </Button>
        </DisabledActionHint>
      </CardContent>
    </Card>
  );
}
