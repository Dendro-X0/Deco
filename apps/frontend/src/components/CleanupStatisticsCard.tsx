import { useState } from 'react';
import { Check, ClipboardCopy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBytes } from '@/lib/format';
import { useI18n } from '@/i18n';
import {
  formatCleanupDiagnostics,
  formatCleanupRunHeadlineLocalized,
  type CleanupRunSummary,
} from '@/lib/cleanup-statistics';

type Props = {
  summary: CleanupRunSummary;
};

export function CleanupStatisticsCard({ summary }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const { result, removedKinds } = summary;
  const deleted = result.deleted_count ?? 0;
  const quarantined = result.quarantined_count ?? 0;
  const freed = result.freed_bytes ?? 0;
  const skippedReview = result.skipped_review_count ?? 0;
  const skippedMissing = result.skipped_not_found_count ?? 0;
  const skippedOptIn = result.skipped_opt_in_count ?? 0;
  const skippedBlocked = result.skipped_blocked_count ?? 0;
  const errorCount = result.errors?.length ?? 0;

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(formatCleanupDiagnostics(summary));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    }
  };

  return (
    <Card className="border-emerald-500/25 bg-emerald-500/5">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400 shrink-0">
            <Trash2 size={18} aria-hidden />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base">{t('dashboard.cleanupStats.title')}</CardTitle>
            <CardDescription className="break-words">
              {formatCleanupRunHeadlineLocalized(t, summary)}
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
          {copied ? t('dashboard.cleanupStats.copied') : t('dashboard.cleanupStats.copyDiagnostics')}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <ResultStat
            label={t('dashboard.cleanupStats.spaceFreed')}
            value={formatBytes(freed)}
            highlight
          />
          <ResultStat
            label={t('dashboard.cleanupStats.foldersRemoved')}
            value={String(deleted)}
            sub={deleted > 0 ? t('dashboard.cleanupStats.deletedInPlace') : undefined}
          />
          <ResultStat
            label={t('dashboard.cleanupStats.quarantined')}
            value={String(quarantined)}
            sub={quarantined > 0 ? t('dashboard.cleanupStats.restoreHint') : undefined}
          />
        </div>

        {(skippedReview > 0 ||
          skippedMissing > 0 ||
          skippedOptIn > 0 ||
          skippedBlocked > 0 ||
          errorCount > 0) && (
          <div className="rounded-lg border border-border/50 bg-card/40 px-4 py-3 space-y-1 text-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('dashboard.cleanupStats.skippedIssues')}
            </p>
            {skippedReview > 0 ? (
              <p className="text-muted-foreground">
                {t('dashboard.cleanupStats.reviewSkipped', { count: skippedReview })}
              </p>
            ) : null}
            {skippedMissing > 0 ? (
              <p className="text-muted-foreground">
                {t('dashboard.cleanupStats.missingSkipped', { count: skippedMissing })}
              </p>
            ) : null}
            {skippedOptIn > 0 ? (
              <p className="text-muted-foreground">
                {t('dashboard.cleanupStats.optInSkipped', { count: skippedOptIn })}
              </p>
            ) : null}
            {skippedBlocked > 0 ? (
              <p className="text-muted-foreground">
                {t('dashboard.cleanupStats.blockedSkipped', { count: skippedBlocked })}
              </p>
            ) : null}
            {errorCount > 0 ? (
              <p className="text-destructive text-xs">{result.errors?.slice(0, 2).join(' · ')}</p>
            ) : null}
          </div>
        )}

        {removedKinds.length > 0 ? (
          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t('dashboard.cleanupStats.removedByKind')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {removedKinds.map((row) => (
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

function ResultStat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${highlight ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-border/50 bg-card/30'}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p
        className={`text-xl font-black tabular-nums mt-1 ${highlight ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
      >
        {value}
      </p>
      {sub ? <p className="text-xs text-muted-foreground mt-0.5">{sub}</p> : null}
    </div>
  );
}
