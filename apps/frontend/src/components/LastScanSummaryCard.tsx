import { History as HistoryIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useI18n } from '@/i18n';
import { formatBytes } from '@/lib/format';
import { inferHistoryScanMode } from '@/lib/history-reuse';
import { volumesFromRoots } from '@/lib/scan-report';
import type { HistoryItem } from '@/types';

type Props = {
  item: HistoryItem;
  onViewHistory: () => void;
  onReuse: () => void;
};

export function LastScanSummaryCard({ item, onViewHistory, onReuse }: Props) {
  const { t } = useI18n();
  const profileLabels: Record<string, string> = {
    safe: t('dashboard.scanTargets.profiles.safe'),
    balanced: t('dashboard.scanTargets.profiles.balanced'),
    aggressive: t('dashboard.scanTargets.profiles.aggressive'),
  };
  const mode = inferHistoryScanMode(item.roots);
  const drives = volumesFromRoots(item.roots);
  const candidates = item.candidate_count ?? 0;

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-2">
        <div>
          <CardTitle className="text-base">{t('dashboard.lastScan.title')}</CardTitle>
          <CardDescription>{new Date(item.created_at).toLocaleString()}</CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="gap-1 h-8 shrink-0" onClick={onViewHistory}>
          <HistoryIcon size={14} />
          {t('dashboard.lastScan.history')}
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm flex-1">
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
              {t('dashboard.lastScan.reclaimable')}
            </p>
            <p className="font-black text-primary">{formatBytes(item.total_bytes)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
              {t('dashboard.lastScan.candidates')}
            </p>
            <p className="font-semibold">{candidates}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
              {t('dashboard.lastScan.profile')}
            </p>
            <p className="font-semibold">{profileLabels[item.profile] ?? item.profile}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">
              {t('dashboard.lastScan.mode')}
            </p>
            <p className="font-semibold text-xs">
              {mode === 'custom'
                ? `${item.roots.length} folder${item.roots.length === 1 ? '' : 's'}`
                : drives.length > 0
                  ? drives.join(', ')
                  : t('dashboard.lastScan.modes.partition')}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" className="shrink-0 font-semibold" onClick={onReuse}>
          {t('dashboard.lastScan.reuse')}
        </Button>
      </CardContent>
    </Card>
  );
}
