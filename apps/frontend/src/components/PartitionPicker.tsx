import { useCallback, useEffect, useState } from 'react';
import { HardDrive, RefreshCw } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatBytes } from '@/lib/format';
import type { StorageVolume } from '@/types';

type Props = {
  selectedVolumes: string[];
  includeProjectFolders: boolean;
  onSelectedVolumesChange: (mounts: string[]) => void;
  onIncludeProjectFoldersChange: (value: boolean) => void;
  disabled?: boolean;
  showQuickAddSelect?: boolean;
  /** Increment after scan/cleanup/purge to refresh free-space figures. */
  storageRefreshToken?: number;
};

export function PartitionPicker({
  selectedVolumes,
  includeProjectFolders,
  onSelectedVolumesChange,
  onIncludeProjectFoldersChange,
  disabled,
  showQuickAddSelect,
  storageRefreshToken = 0,
}: Props) {
  const [volumes, setVolumes] = useState<StorageVolume[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectKey, setSelectKey] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = (await invoke('list_storage_volumes_command')) as StorageVolume[];
      setVolumes(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, storageRefreshToken]);

  const toggleVolume = (mount: string, checked: boolean) => {
    const next = new Set(selectedVolumes);
    if (checked) next.add(mount);
    else next.delete(mount);
    onSelectedVolumesChange(Array.from(next).sort());
  };

  const selectAllFixed = () => {
    onSelectedVolumesChange(
      volumes.filter((v) => v.volume_kind === 'fixed').map((v) => v.mount_point),
    );
  };

  const pctUsed = (v: StorageVolume) =>
    v.total_bytes > 0 ? Math.min(100, Math.round((v.used_bytes / v.total_bytes) * 100)) : 0;

  const unselected = volumes.filter((v) => !selectedVolumes.includes(v.mount_point));

  const addVolume = (mount: string) => {
    if (!mount || selectedVolumes.includes(mount)) return;
    onSelectedVolumesChange([...selectedVolumes, mount].sort());
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-card/40 p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HardDrive size={18} className="text-primary" />
          <div>
            <p className="font-bold text-sm">Partitions to scan</p>
            <p className="text-xs text-muted-foreground">
              Each selected drive includes its volume root (e.g. D:\\) so top-level trees are scanned;
              system folders are skipped.
            </p>
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={refresh} disabled={loading || disabled}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {showQuickAddSelect && !loading && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add drive</p>
          <Select
            key={selectKey}
            onValueChange={(value) => {
              addVolume(value);
              setSelectKey((k) => k + 1);
            }}
            disabled={disabled || unselected.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={unselected.length ? 'Choose a partition…' : 'All drives already selected'}
              />
            </SelectTrigger>
            <SelectContent>
              {unselected.map((vol) => (
                <SelectItem key={vol.mount_point} value={vol.mount_point}>
                  {vol.name ? `${vol.name} (${vol.mount_point})` : vol.mount_point}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedVolumes.length > 0 && (
            <p className="text-xs text-muted-foreground">Selected: {selectedVolumes.join(', ')}</p>
          )}
        </div>
      )}

      {loading && volumes.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Detecting local storage…</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {volumes.map((vol) => {
            const checked = selectedVolumes.includes(vol.mount_point);
            const usedPct = pctUsed(vol);
            return (
              <div
                key={vol.mount_point}
                role="button"
                tabIndex={disabled ? -1 : 0}
                onClick={() => !disabled && toggleVolume(vol.mount_point, !checked)}
                onKeyDown={(e) => {
                  if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    toggleVolume(vol.mount_point, !checked);
                  }
                }}
                className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors text-left ${
                  checked ? 'border-primary/40 bg-primary/5' : 'border-border/50 bg-background/30 hover:bg-muted/20'
                } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => toggleVolume(vol.mount_point, v === true)}
                  onClick={(e) => e.stopPropagation()}
                  className="mt-0.5 pointer-events-auto"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{vol.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{vol.mount_point}</p>
                  <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full ${usedPct > 90 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatBytes(vol.available_bytes)} free of {formatBytes(vol.total_bytes)}
                    <span className="ml-1 opacity-70">({vol.volume_kind})</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-border/40">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox
            checked={includeProjectFolders}
            onCheckedChange={(v) => onIncludeProjectFoldersChange(v === true)}
            disabled={disabled}
          />
          Also scan dev folders on selected drives (Users\…\Projects, source, code, …)
        </label>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={selectAllFixed} disabled={disabled}>
            All fixed drives
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectedVolumesChange([])}
            disabled={disabled}
          >
            Clear
          </Button>
        </div>
      </div>
    </div>
  );
}
