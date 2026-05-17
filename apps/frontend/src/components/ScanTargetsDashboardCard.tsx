import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { CustomScanRoots } from '@/components/CustomScanRoots';
import { PartitionPicker } from '@/components/PartitionPicker';
import { ScanModeTabList } from '@/components/ScanModeTabs';
import type { ScanMode } from '@/components/ScanModeSelector';
import { scanStrategySummary, resolveScanStrategy } from '@/lib/scan-strategy';
import type { Settings } from '@/types';

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
  settings?: Settings | null;
  ready: boolean;
  disabled?: boolean;
  onError?: (message: string) => void;
  storageRefreshToken?: number;
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
  settings,
  ready,
  disabled,
  onError,
  storageRefreshToken,
}: Props) {
  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Scan targets</CardTitle>
        <CardDescription>
          {ready
            ? 'Choose drives or folders, then run Scan Now.'
            : 'Select at least one drive or custom folder before scanning.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            Profile: {PROFILE_LABELS[profile] ?? profile}
          </span>
          {settings ? (
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Strategy:{' '}
              {scanStrategySummary(resolveScanStrategy(settings), settings)}
            </span>
          ) : null}
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
                storageRefreshToken={storageRefreshToken}
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
