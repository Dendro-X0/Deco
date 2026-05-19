import { useMemo } from 'react';
import { HardDrive } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { NumberInput } from '@/components/ui/number-input';
import { DisabledActionHint } from '@/components/DisabledActionHint';
import { useI18n } from '@/i18n';
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
  const { t } = useI18n();
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
          <HardDrive size={14} /> {t('dashboard.planner.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasScan ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t('dashboard.planner.noScan')}
          </p>
        ) : (
          <>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{t('dashboard.planner.reclaimable')}</span>
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
                  title={t('dashboard.planner.targetGb', { gb: plannerGb })}
                />
              </div>
              <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-primary/70" />
                  {t('dashboard.planner.safeLegend')} {formatBytes(safeBytes)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-amber-500/70" />
                  {t('dashboard.planner.reviewLegend')} {formatBytes(reviewBytes)}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase text-muted-foreground">
                {t('dashboard.planner.targetLabel')}
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
                aria-label={t('dashboard.planner.sliderAria')}
              />
              <NumberInput
                min={1}
                max={maxGb}
                step={1}
                value={plannerGb}
                onValueChange={onPlannerGbChange}
                disabled={disabled}
                aria-label={t('dashboard.planner.targetAria')}
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
            {t('dashboard.planner.planSafe')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="h-9 text-xs"
            disabled={disabled || !hasScan}
            onClick={onPlanReview}
          >
            {t('dashboard.planner.planReview')}
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
            {t('dashboard.planner.previewCleanup')}
          </Button>
        </DisabledActionHint>
      </CardContent>
    </Card>
  );
}
