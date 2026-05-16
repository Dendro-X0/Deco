import { Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { CustomScanRoots } from '@/components/CustomScanRoots';
import { PartitionPicker } from '@/components/PartitionPicker';
import { ScanModeTabList } from '@/components/ScanModeTabs';
import type { ScanMode } from '@/components/ScanModeSelector';

const PROFILE_LABELS: Record<string, string> = {
  safe: 'Safe (Conservative)',
  balanced: 'Balanced',
  aggressive: 'Aggressive',
};

type Props = {
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  selectedVolumes: string[];
  includeProjectFolders: boolean;
  customScanRoots: string[];
  onSelectedVolumesChange: (mounts: string[]) => void;
  onIncludeProjectFoldersChange: (value: boolean) => void;
  onCustomScanRootsChange: (roots: string[]) => void;
  profile?: string;
  ready: boolean;
  disabled?: boolean;
  onEditSettings: () => void;
  onError?: (message: string) => void;
};

export function ScanTargetsDashboardCard({
  mode,
  onModeChange,
  selectedVolumes,
  includeProjectFolders,
  customScanRoots,
  onSelectedVolumesChange,
  onIncludeProjectFoldersChange,
  onCustomScanRootsChange,
  profile = 'safe',
  ready,
  disabled,
  onEditSettings,
  onError,
}: Props) {
  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div>
          <CardTitle className="text-base">Scan targets</CardTitle>
          <CardDescription>
            {ready
              ? 'Choose drives or folders, then run Scan Now.'
              : 'Select at least one drive or custom folder before scanning.'}
          </CardDescription>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5 h-8 shrink-0"
          disabled={disabled}
          onClick={onEditSettings}
        >
          <Settings2 size={14} />
          Edit in Settings
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Profile: {PROFILE_LABELS[profile] ?? profile}
          </span>
          {!ready ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-500">
              Not ready
            </span>
          ) : null}
        </div>

        <Tabs
          value={mode}
          onValueChange={(v) => onModeChange(v as ScanMode)}
          className="w-full"
        >
          <ScanModeTabList disabled={disabled} />

          <TabsContent value="partition" className="mt-4 focus-visible:outline-none">
            {mode === 'partition' ? (
              <PartitionPicker
                showQuickAddSelect
                selectedVolumes={selectedVolumes}
                includeProjectFolders={includeProjectFolders}
                onSelectedVolumesChange={onSelectedVolumesChange}
                onIncludeProjectFoldersChange={onIncludeProjectFoldersChange}
                disabled={disabled}
              />
            ) : null}
          </TabsContent>

          <TabsContent value="custom" className="mt-4 focus-visible:outline-none">
            {mode === 'custom' ? (
              <CustomScanRoots
                roots={customScanRoots}
                onRootsChange={onCustomScanRootsChange}
                disabled={disabled}
                onError={onError}
              />
            ) : null}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
