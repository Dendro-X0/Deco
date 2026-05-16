import { useMemo, useState } from 'react';
import { History as HistoryIcon, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { formatBytes } from '@/lib/format';
import {
  filterHistoryItems,
  HISTORY_TIME_RANGE_OPTIONS,
  historyFilterFromInputs,
  historyFiltersActive,
  type HistoryTimeRange,
  uniqueHistoryVolumes,
} from '@/lib/history-filter';
import { volumesFromRoots } from '@/lib/scan-report';
import type { HistoryItem } from '@/types';

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
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Scan History</CardTitle>
            <CardDescription>
              Review previous scan sessions and their reclaimed space.
            </CardDescription>
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1 shrink-0"
            disabled={items.length === 0 || busy}
            onClick={() => setPending({ kind: 'clear' })}
          >
            <Trash2 size={14} />
            Clear all
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border/40 bg-background/40 p-3">
            <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">
              Filters
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">Size (min)</label>
                <Input
                  placeholder="100MB"
                  className="h-8 bg-background/50 text-sm"
                  value={sizeMinInput}
                  onChange={(e) => setSizeMinInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">Size (max)</label>
                <Input
                  placeholder="50GB"
                  className="h-8 bg-background/50 text-sm"
                  value={sizeMaxInput}
                  onChange={(e) => setSizeMaxInput(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-semibold text-muted-foreground">When</label>
                <Select value={timeRange} onValueChange={(v) => setTimeRange(v as HistoryTimeRange)}>
                  <SelectTrigger className="h-8 bg-background/50">
                    <SelectValue placeholder="Any time" />
                  </SelectTrigger>
                  <SelectContent>
                    {HISTORY_TIME_RANGE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="space-y-1 flex-1 min-w-[10rem]">
                <label className="text-[10px] font-semibold text-muted-foreground">
                  Partition / drive
                </label>
                <Select value={volumeMount} onValueChange={setVolumeMount}>
                  <SelectTrigger className="h-8 bg-background/50">
                    <SelectValue placeholder="All drives" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All drives</SelectItem>
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
                    Reset
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {filtered.length > 0 ? (
            <div className="space-y-3">
              {filtersActive && filtered.length !== items.length ? (
                <p className="text-xs text-muted-foreground">
                  Showing {filtered.length} of {items.length} records
                </p>
              ) : null}
              {filtered.map((item) => (
                <div
                  key={item.scan_id}
                  className="p-4 rounded-lg border bg-background/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="font-bold text-sm tracking-tight">
                      {new Date(item.created_at).toLocaleString()}
                    </p>
                    <p className="text-[10px] text-muted-foreground opacity-70 truncate">
                      Roots: {item.roots.join(', ')}
                    </p>
                    {volumesFromRoots(item.roots).length > 0 ? (
                      <p className="text-[10px] text-muted-foreground/60">
                        Drives: {volumesFromRoots(item.roots).join(', ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3 sm:gap-6 shrink-0">
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">
                        Recovered
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
                        Reuse Config
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
                            label: new Date(item.created_at).toLocaleString(),
                          })
                        }
                      >
                        <Trash2 size={14} />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="py-16 text-center flex flex-col items-center gap-3">
              <Search className="h-8 w-8 text-muted-foreground/40" />
              <p className="text-muted-foreground font-medium">No records match these filters.</p>
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
                <HistoryIcon className="text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground font-medium">No history available.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title="Delete scan record?"
        description={
          pending?.kind === 'delete'
            ? `Remove the scan from ${pending.label}? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => !busy && setPending(null)}
      />

      <ConfirmDialog
        open={pending?.kind === 'clear'}
        title="Clear all scan history?"
        description={`Remove all ${items.length} scan records from this device? This cannot be undone.`}
        confirmLabel="Clear all"
        destructive
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => !busy && setPending(null)}
      />
    </>
  );
}
