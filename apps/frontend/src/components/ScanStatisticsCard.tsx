import { useState } from 'react';
import { BarChart3, ClipboardCopy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes, formatDurationMs } from '@/lib/format';
import {
  formatScanDiagnostics,
  inventoryReusePercent,
  phaseShares,
  topKindsByBytes,
  type ScanRunMetrics,
} from '@/lib/scan-statistics';
import { APP_VERSION } from '@/lib/app-version';
import { useI18n } from '@/i18n';
import type { ScanReport } from '@/types';

const PHASE_I18N: Record<string, 'discover' | 'classify' | 'size'> = {
  discoverMs: 'discover',
  classifyMs: 'classify',
  sizeMs: 'size',
};

type Props = {
  report: ScanReport;
  metrics: ScanRunMetrics | null;
};

export function ScanStatisticsCard({ report, metrics }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timings = metrics;
  const shares = timings ? phaseShares(timings) : [];
  const kinds = topKindsByBytes(report, 6);
  const reusePct =
    metrics?.inventoryReused != null
      ? inventoryReusePercent(metrics.inventoryReused, report.candidates.length)
      : null;

  const copyDiagnostics = async () => {
    const text = formatScanDiagnostics(report, metrics, { appVersion: APP_VERSION });
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  };

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <BarChart3 size={18} aria-hidden />
          </div>
          <div>
            <CardTitle className="text-base">{t('dashboard.scanStats.title')}</CardTitle>
            <CardDescription>
              {timings
                ? (() => {
                    const fmt = (ms: number) =>
                      ms >= 1000 ? formatDurationMs(ms) : `${Math.round(ms)}ms`;
                    return t('dashboard.scanStats.phaseTimingLine', {
                      discover: fmt(timings.discoverMs),
                      classify: fmt(timings.classifyMs),
                      size: fmt(timings.sizeMs),
                    });
                  })()
                : t('dashboard.scanStats.phasesUnavailable')}
              {metrics?.wallMs != null && metrics.wallMs > 0
                ? t('dashboard.scanStats.wallSuffix', {
                    duration: formatDurationMs(metrics.wallMs),
                  })
                : null}
            </CardDescription>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5 h-8"
          onClick={() => void copyDiagnostics()}
        >
          {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
          {copied ? t('dashboard.scanStats.copied') : t('dashboard.scanStats.copyDiagnostics')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {reusePct != null ? (
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('dashboard.scanStats.quickUpdateReuse')}
            </p>
            <p className="text-sm font-semibold mt-1">
              {t('dashboard.scanStats.quickUpdateReuseDetail', {
                reused: metrics?.inventoryReused ?? 0,
                total: report.candidates.length,
                percent: reusePct ?? 0,
              })}
            </p>
          </div>
        ) : null}

        {shares.length > 0 && shares.some((s) => s.ms > 0) ? (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('dashboard.scanStats.timeByPhase')}
            </p>
            <div className="space-y-2">
              {shares.map((share) => (
                <div key={share.phase} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">
                      {t(
                        `dashboard.scanStats.phases.${PHASE_I18N[share.phase] ?? 'discover'}`,
                      )}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {share.percent}% ·{' '}
                      {share.ms >= 1000
                        ? `${(share.ms / 1000).toFixed(1)}s`
                        : `${Math.round(share.ms)}ms`}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted/40 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary/80 transition-all"
                      style={{ width: `${Math.max(share.percent, share.ms > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {kinds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('dashboard.scanStats.topKindsBySize')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {kinds.map((row) => (
                <div
                  key={row.kind}
                  className="flex items-center justify-between gap-2 rounded-md bg-muted/20 px-3 py-2 text-sm"
                >
                  <span className="font-medium truncate" title={row.kind}>
                    {row.label}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {row.count} · {formatBytes(row.bytes)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
