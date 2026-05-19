import { useMemo, useState } from 'react';
import { History as HistoryIcon, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { CollapsibleFilterSection } from '@/components/CollapsibleFilterSection';
import { useI18n } from '@/i18n';
import { formatBytes } from '@/lib/format';
import {
  filterHistoryItems,
  historyFilterFromInputs,
  historyFiltersActive,
  type HistoryTimeRange,
  uniqueHistoryVolumes,
} from '@/lib/history-filter';
import { localeToIntlTag } from '@/lib/ui-locale';
import { volumesFromRoots } from '@/lib/scan-report';
import type { HistoryItem } from '@/types';

const HISTORY_TIME_RANGES: HistoryTimeRange[] = ['all', '1h', '24h', '7d', '30d'];

type Props = {
  items: HistoryItem[];
  onReuse: (item: HistoryItem) => void;
  onDelete: (scanId: string) => Promise<boolean>;
  onClearAll: () => Promise<number>;
};

type PendingConfirm =
  | { kind: 'delete'; scanId: string; label: string }
  | { kind: 'clear' }
  | null;

export function ScanHistoryPanel({ items, onReuse, onDelete, onClearAll }: Props) {
  const { t, locale } = useI18n();
  const intlTag = localeToIntlTag(locale);
  const formatWhen = (iso: string) => new Date(iso).toLocaleString(intlTag);

  const [sizeMinInput, setSizeMinInput] = useState('');
  const [sizeMaxInput, setSizeMaxInput] = useState('');
  const [timeRange, setTimeRange] = useState<HistoryTimeRange>('all');
  const [volumeMount, setVolumeMount] = useState('all');
  const [pending, setPending] = useState<PendingConfirm>(null);
  const [busy, setBusy] = useState(false);

  const volumeOptions = useMemo(() => uniqueHistoryVolumes(items), [items]);

  const filters = useMemo(
    () => historyFilterFromInputs(sizeMinInput, sizeMaxInput, timeRange, volumeMount),
    [sizeMinInput, sizeMaxInput, timeRange, volumeMount],
  );

  const filtered = useMemo(() => filterHistoryItems(items, filters), [items, filters]);
  const filtersActive = historyFiltersActive(filters);

  const resetFilters = () => {
    setSizeMinInput('');
    setSizeMaxInput('');
    setTimeRange('all');
    setVolumeMount('all');
  };

  const handleConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === 'delete') {
        await onDelete(pending.scanId);
      } else {
        await onClearAll();
      }
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="border-border/40 bg-card/30">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="gap-1 shrink-0"
              disabled={items.length === 0 || busy}
              onClick={() => setPending({ kind: 'clear' })}
            >
              <Trash2 size={14} />
              {t('history.clearAll')}
            </Button>
          </div>

          <CollapsibleFilterSection label={t('history.filters')} active={filtersActive}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{t('history.sizeMin')}</label>
                <Input
                  placeholder="100MB"
                  className="h-8 bg-background/50 text-sm"
                  value={sizeMinInput}
                  onChange={(e) => setSizeMinInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{t('history.sizeMax')}</label>
                <Input
                  placeholder="50GB"
                  className="h-8 bg-background/50 text-sm"
                  value={sizeMaxInput}
                  onChange={(e) => setSizeMaxInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">{t('history.when')}</label>
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as HistoryTimeRange)}>
                  <SelectTrigger className="h-8 bg-background/50">
                    <SelectValue placeholder={t('common.anyTime')} />
                  </SelectTrigger>
                  <SelectContent>
                    {HISTORY_TIME_RANGES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`history.timeRange.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="space-y-1 flex-1 min-w-[10rem]">
                <label className="text-[10px] font-semibold text-muted-foreground">
                  {t('history.partition')}
                </label>
                <Select value={volumeMount} onValueChange={setVolumeMount}>
                  <SelectTrigger className="h-8 bg-background/50">
                    <SelectValue placeholder={t('common.allDrives')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('common.allDrives')}</SelectItem>
                    {volumeOptions.map((vol) => (
                      <SelectItem key={vol} value={vol}>
                        {vol}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 sm:pb-0.5">
                {filtersActive ? (
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    {t('common.reset')}
                  </Button>
                ) : null}
              </div>
            </div>
          </CollapsibleFilterSection>

          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtersActive && filtered.length !== items.length ? (
                <p className="text-xs text-muted-foreground">
                  {t('history.showing', { filtered: filtered.length, total: items.length })}
                </p>
              ) : null}
              {filtered.map((item) => (
                <div
                  key={item.scan_id}
                  className="p-4 rounded-lg border bg-background/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-sm tracking-tight">
                      {formatWhen(item.created_at)}
                    </p>
                    <p className="text-xs text-foreground/70 truncate">
                      {t('history.roots', { list: item.roots.join(', ') })}
                    </p>
                    {volumesFromRoots(item.roots).length > 0 ? (
                      <p className="text-xs text-foreground/70">
                        {t('history.drives', { list: volumesFromRoots(item.roots).join(', ') })}
                      </p>
                    ) : null}
                    <p className="text-xs text-foreground/70">
                      {t('history.meta', {
                        count: item.candidate_count ?? 0,
                        profile: item.profile,
                        safe:
                          item.safe_count != null
                            ? t('history.safeSuffix', { count: item.safe_count })
                            : '',
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">
                        {t('history.recovered')}
                      </p>
                      <p className="text-sm font-black text-primary">{formatBytes(item.total_bytes)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="h-8 font-semibold"
                        onClick={() => onReuse(item)}
                      >
                        {t('history.reuseConfig')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() =>
                          setPending({
                            kind: 'delete',
                            scanId: item.scan_id,
                            label: formatWhen(item.created_at),
                          })
                        }
                      >
                        <Trash2 size={14} />
                        {t('common.delete')}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-3">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">{t('history.noMatch')}</p>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                {t('history.clearFilters')}
              </Button>
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                <HistoryIcon className="text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-medium">{t('history.empty')}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title={t('history.deleteTitle')}
        description={
          pending?.kind === 'delete'
            ? t('history.deleteDescription', { label: pending.label })
            : ''
        }
        confirmLabel={t('common.delete')}
        destructive
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => !busy && setPending(null)}
      />

      <ConfirmDialog
        open={pending?.kind === 'clear'}
        title={t('history.clearTitle')}
        description={t('history.clearDescription', { count: items.length })}
        confirmLabel={t('history.clearAll')}
        destructive
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => !busy && setPending(null)}
      />
    </>
  );
}
