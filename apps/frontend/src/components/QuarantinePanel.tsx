import { useMemo, useState } from 'react';
import { Download, Search, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { formatBytes } from '@/lib/format';
import type { BulkRestoreResponse, QuarantineEntry, QuarantineFilter } from '@/types';

type Props = {
  entries: QuarantineEntry[];
  retentionDays: number;
  onRefresh: (filter: QuarantineFilter) => void;
  onRestore: (id: string) => void;
  onBulkRestore: (ids: string[]) => Promise<BulkRestoreResponse | null>;
  onPurge: () => void;
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
  onRefresh,
  onRestore,
  onBulkRestore,
  onPurge,
}: Props) {
  const [query, setQuery] = useState('');
  const [onlyPurgeEligible, setOnlyPurgeEligible] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restoring, setRestoring] = useState(false);

  const applyFilter = () => {
    onRefresh({
      query: query.trim() || null,
      from_iso: null,
      to_iso: null,
      only_purge_eligible: onlyPurgeEligible,
      retention_days: retentionDays,
    });
    setSelectedIds(new Set());
  };

  const toggleEntry = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = entries.length > 0 && selectedIds.size === entries.length;

  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(new Set(entries.map((e) => e.id)));
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

  const totalBytes = useMemo(
    () => entries.reduce((sum, e) => sum + (e.size_bytes ?? 0), 0),
    [entries],
  );

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Quarantine</CardTitle>
          <CardDescription>
            Temporarily held folders — restore anytime, or purge items older than {retentionDays} days.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button variant="outline" size="sm" onClick={() => applyFilter()}>
            Refresh
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => downloadAuditLog(entries)}>
            <Download size={14} /> Export log
          </Button>
          <Button variant="destructive" size="sm" onClick={onPurge}>
            Purge eligible
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by path or id…"
              className="pl-8 bg-background/50"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            />
          </div>
          <label className="flex items-center gap-2 text-sm shrink-0 cursor-pointer px-2">
            <Checkbox checked={onlyPurgeEligible} onCheckedChange={(v) => setOnlyPurgeEligible(v === true)} />
            Purge-eligible only
          </label>
          <Button variant="secondary" size="sm" onClick={applyFilter}>
            Apply filter
          </Button>
        </div>

        {entries.length > 0 && (
          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={allSelected} onCheckedChange={(v) => handleSelectAll(v === true)} />
              Select all ({entries.length})
            </label>
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground text-xs">{formatBytes(totalBytes)} held</span>
              {selectedIds.size > 0 && (
                <Button size="sm" variant="secondary" disabled={restoring} onClick={handleBulkRestore}>
                  Restore selected ({selectedIds.size})
                </Button>
              )}
            </div>
          </div>
        )}

        {entries.length > 0 ? (
          <div className="space-y-3">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="p-4 rounded-lg border bg-background/50 flex items-center justify-between group hover:border-primary/30 transition-all"
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
                        {new Date(entry.timestamp_iso).toLocaleString()}
                      </span>
                      {entry.size_bytes != null && (
                        <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded">
                          {formatBytes(entry.size_bytes)}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground truncate">{entry.original_path}</p>
                    {entry.reason_summary && (
                      <p className="text-[10px] text-muted-foreground">{entry.reason_summary}</p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={() => onRestore(entry.id)}
                >
                  Restore
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-muted/20 flex items-center justify-center">
              <ShieldAlert className="text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">Quarantine is empty.</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Cleaned folders appear here until you restore them or they are purged after the retention period.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
