import { FolderTree, HardDrive, Settings2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScanMode } from '@/components/ScanModeSelector';

const PROFILE_LABELS: Record<string, string> = {
  safe: 'Safe (Conservative)',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

type Props = {
  mode: ScanMode;
  selectedVolumes: string[];
  includeProjectFolders: boolean;
  customScanRoots: string[];
  profile?: string;
  scanScope?: string;
  ready: boolean;
  disabled?: boolean;
  onEditSettings: () => void;
  onQuickConfigure: () => void;
};

export function ScanTargetsSummaryCard({
  mode,
  selectedVolumes,
  includeProjectFolders,
  customScanRoots,
  profile = 'safe',
  scanScope = 'all',
  ready,
  disabled,
  onEditSettings,
  onQuickConfigure,
}: Props) {
  const partitionMode = mode === 'partition';
  const scopeLabel =
    scanScope === 'projects'
      ? 'Project folders'
      : scanScope === 'drives'
        ? 'Drive roots only'
        : 'Dev folders + drives';

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base">Scan targets</CardTitle>
          <CardDescription>
            {ready
              ? 'Configured in Settings — use Scan Now when ready.'
              : 'Choose drives or custom folders before scanning.'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0 justify-end">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            disabled={disabled}
            onClick={onQuickConfigure}
          >
            <SlidersHorizontal size={14} />
            Quick adjust
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="gap-1.5 h-8"
            disabled={disabled}
            onClick={onEditSettings}
          >
            <Settings2 size={14} />
            Edit in Settings
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border ${
              partitionMode
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-primary/40 bg-primary/10 text-primary'
            }`}
          >
            {partitionMode ? <HardDrive size={12} /> : <FolderTree size={12} />}
            {partitionMode ? 'Partition scan' : 'Custom folders'}
          </span>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Profile: {PROFILE_LABELS[profile] ?? profile}
          </span>
          {!ready ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-500">
              Not ready
            </span>
          ) : null}
        </div>

        {partitionMode ? (
          <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 space-y-1.5 text-sm">
            <p className="text-muted-foreground text-xs">
              <span className="font-semibold text-foreground">Drives: </span>
              {selectedVolumes.length > 0 ? selectedVolumes.join(', ') : 'None selected'}
            </p>
            <p className="text-muted-foreground text-xs">
              <span className="font-semibold text-foreground">Dev folders: </span>
              {includeProjectFolders ? 'Included on selected drives' : 'Off'}
            </p>
            <p className="text-muted-foreground text-xs">
              <span className="font-semibold text-foreground">Scope: </span>
              {scopeLabel}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border/40 bg-background/40 px-3 py-2.5 space-y-1.5 text-sm">
            <p className="text-muted-foreground text-xs">
              <span className="font-semibold text-foreground">
                {customScanRoots.length} folder{customScanRoots.length === 1 ? '' : 's'}
              </span>
              {customScanRoots.length === 0 ? ' — add paths in Settings' : ''}
            </p>
            {customScanRoots.length > 0 ? (
              <ul className="text-[11px] font-mono text-muted-foreground space-y-0.5 max-h-20 overflow-y-auto">
                {customScanRoots.slice(0, 5).map((path) => (
                  <li key={path} className="truncate" title={path}>
                    {path}
                  </li>
                ))}
                {customScanRoots.length > 5 ? (
                  <li className="text-[10px] italic">+{customScanRoots.length - 5} more</li>
                ) : null}
              </ul>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
