import { useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Download, FolderOpen, LayoutDashboard, Search, ShieldAlert, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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
import { DisabledActionHint } from '@/components/DisabledActionHint';
import { useI18n } from '@/i18n';
import { formatBytes } from '@/lib/format';
import {
  countPurgeEligible,
  daysUntilPurgeEligible,
  filterQuarantineEntries,
  quarantineFilterFromInputs,
  quarantineFiltersActive,
  type HistoryTimeRange,
  uniqueQuarantineVolumes,
} from '@/lib/quarantine-filter';
import { localeToIntlTag } from '@/lib/ui-locale';
import type { BulkRestoreResponse, QuarantineEntry } from '@/types';

const HISTORY_TIME_RANGES: HistoryTimeRange[] = ['all', '1h', '24h', '7d', '30d'];

type Props = {
  entries: QuarantineEntry[];
  retentionDays: number;
  onReload: () => void | Promise<void>;
  onRestore: (id: string) => void | Promise<void>;
  onBulkRestore: (ids: string[]) => Promise<BulkRestoreResponse | null>;
  onPurge: () => void | Promise<void>;
  onGoToDashboard?: () => void;
};

function downloadAuditLog(entries: QuarantineEntry[]) {
  const payload = {
    exported_at: new Date().toISOString(),
    entry_count: entries.length,
    entries,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `deco-quarantine-audit-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function QuarantinePanel({
  entries,
  retentionDays,
  onReload,
  onRestore,
  onBulkRestore,
  onPurge,
  onGoToDashboard,
}: Props) {
  const { t, locale } = useI18n();
  const intlTag = localeToIntlTag(locale);
  const formatWhen = (iso: string) => new Date(iso).toLocaleString(intlTag);

  const [searchInput, setSearchInput] = useState('');
  const [sizeMinInput, setSizeMinInput] = useState('');
  const [sizeMaxInput, setSizeMaxInput] = useState('');
  const [timeRange, setTimeRange] = useState<HistoryTimeRange>('all');
  const [volumeMount, setVolumeMount] = useState('all');
  const [onlyPurgeEligible, setOnlyPurgeEligible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(false);
  const [purgeConfirmOpen, setPurgeConfirmOpen] = useState(false);
  const [purging, setPurging] = useState(false);

  const volumeOptions = useMemo(() => uniqueQuarantineVolumes(entries), [entries]);

  const filters = useMemo(
    () =>
      quarantineFilterFromInputs(
        searchInput,
        sizeMinInput,
        sizeMaxInput,
        timeRange,
        volumeMount,
        onlyPurgeEligible,
      ),
    [searchInput, sizeMinInput, sizeMaxInput, timeRange, volumeMount, onlyPurgeEligible],
  );

  const filtered = useMemo(
    () => filterQuarantineEntries(entries, filters, retentionDays),
    [entries, filters, retentionDays],
  );

  const filtersActive = quarantineFiltersActive(filters);
  const purgeEligibleCount = useMemo(
    () => countPurgeEligible(entries, retentionDays),
    [entries, retentionDays],
  );

  const resetFilters = () => {
    setSearchInput('');
    setSizeMinInput('');
    setSizeMaxInput('');
    setTimeRange('all');
    setVolumeMount('all');
    setOnlyPurgeEligible(false);
  };

  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(filtered.map((e) => e.id)));
    else setSelectedIds(new Set());
  };

  const handleBulkRestore = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setRestoring(true);
    try {
      await onBulkRestore(ids);
      setSelectedIds(new Set());
    } finally {
      setRestoring(false);
    }
  };

  const handlePurgeConfirm = async () => {
    setPurging(true);
    try {
      await onPurge();
      setPurgeConfirmOpen(false);
    } finally {
      setPurging(false);
    }
  };

  const revealPath = async (path: string) => {
    try {
      await invoke('reveal_path_in_explorer', { path });
    } catch {
      /* ignore */
    }
  };

  const totalBytes = useMemo(
    () => filtered.reduce((sum, e) => sum + (e.size_bytes ?? 0), 0),
    [filtered],
  );

  const isEmptyStore = entries.length === 0;
  const noFilterMatches = !isEmptyStore && filtered.length === 0;

  return (
    <>
      <Card className="border-border/40 bg-card/30">
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => void onReload()}>
              {t('quarantine.refresh')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              disabled={filtered.length === 0}
              onClick={() => downloadAuditLog(filtered)}
            >
              <Download size={14} /> {t('quarantine.exportLog')}
            </Button>
            <DisabledActionHint
              reason={
                purgeEligibleCount === 0
                  ? t('quarantine.purgeNone', { days: retentionDays })
                  : null
              }
            >
              <Button
                variant="destructive"
                size="sm"
                className="gap-1"
                disabled={purgeEligibleCount === 0}
                onClick={() => setPurgeConfirmOpen(true)}
              >
                <Trash2 size={14} />
                {t('quarantine.purgeEligible')}
              </Button>
            </DisabledActionHint>
          </div>

          <CollapsibleFilterSection label={t('history.filters')} active={filtersActive}>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('quarantine.searchPlaceholder')}
                className="pl-8 h-8 bg-background/50 text-sm"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
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
              <label className="flex items-center gap-2 text-sm shrink-0 cursor-pointer px-1 sm:pb-0.5">
                <Checkbox
                  checked={onlyPurgeEligible}
                  onCheckedChange={(v) => setOnlyPurgeEligible(v === true)}
                />
                {t('quarantine.purgeEligibleOnly')}
              </label>
              {filtersActive ? (
                <Button variant="outline" size="sm" className="sm:pb-0.5" onClick={resetFilters}>
                  {t('common.reset')}
                </Button>
              ) : null}
            </div>
          </CollapsibleFilterSection>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between text-sm flex-wrap gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={allSelected} onCheckedChange={(v) => handleSelectAll(v === true)} />
                {t('quarantine.selectAll', { count: filtered.length })}
              </label>
              <div className="flex items-center gap-3">
                {filtersActive && filtered.length !== entries.length ? (
                  <span className="text-xs text-muted-foreground">
                    {t('quarantine.showing', { filtered: filtered.length, total: entries.length })}
                  </span>
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {t('quarantine.held', { size: formatBytes(totalBytes) })}
                </span>
                {selectedIds.size > 0 ? (
                  <Button size="sm" variant="secondary" disabled={restoring} onClick={() => void handleBulkRestore()}>
                    {t('quarantine.restoreSelected', { count: selectedIds.size })}
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtered.map((entry) => {
                const daysLeft = daysUntilPurgeEligible(entry.timestamp_iso, retentionDays);
                return (
                  <div
                    key={entry.id}
                    className="p-4 rounded-lg border bg-background/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group hover:border-primary/30 transition-all"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Checkbox
                        checked={selectedIds.has(entry.id)}
                        onCheckedChange={() => toggleEntry(entry.id)}
                        className="mt-0.5"
                      />
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm tracking-tight">{entry.id.slice(0, 8)}…</span>
                          <span className="text-[10px] text-muted-foreground">
                            {formatWhen(entry.timestamp_iso)}
                          </span>
                          {entry.size_bytes != null ? (
                            <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                              {formatBytes(entry.size_bytes)}
                            </span>
                          ) : null}
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                              daysLeft === 0
                                ? 'bg-destructive/15 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {daysLeft === 0
                              ? t('quarantine.purgeEligibleBadge')
                              : t('quarantine.daysUntilPurge', { days: daysLeft })}
                          </span>
                        </div>
                        <p className="text-[11px] font-mono text-muted-foreground truncate">
                          {entry.original_path}
                        </p>
                        {entry.reason_summary ? (
                          <p className="text-[10px] text-muted-foreground">{entry.reason_summary}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1"
                        onClick={() => void revealPath(entry.original_path)}
                      >
                        <FolderOpen size={14} />
                        {t('common.show')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        onClick={() => void onRestore(entry.id)}
                      >
                        {t('quarantine.restore')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : noFilterMatches ? (
            <div className="py-16 text-center flex flex-col items-center gap-3">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">{t('quarantine.noMatch')}</p>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                {t('history.clearFilters')}
              </Button>
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                <ShieldAlert className="text-muted-foreground/50" />
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground font-medium">{t('quarantine.emptyTitle')}</p>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {t('quarantine.emptyDescription')}
                </p>
              </div>
              {onGoToDashboard ? (
                <Button className="gap-2 font-semibold" onClick={onGoToDashboard}>
                  <LayoutDashboard size={16} />
                  {t('quarantine.goToDashboard')}
                </Button>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={purgeConfirmOpen}
        title={t('quarantine.purgeTitle')}
        description={
          purgeEligibleCount > 0
            ? t('quarantine.purgeDescription', { count: purgeEligibleCount, days: retentionDays })
            : t('quarantine.purgeNoneEligible')
        }
        confirmLabel={t('quarantine.purge')}
        destructive
        busy={purging}
        onConfirm={() => void handlePurgeConfirm()}
        onCancel={() => !purging && setPurgeConfirmOpen(false)}
      />
    </>
  );
}
