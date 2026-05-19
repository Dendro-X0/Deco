import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { CustomScanRoots } from '@/components/CustomScanRoots';
import { PartitionPicker } from '@/components/PartitionPicker';
import { ScanModeTabList } from '@/components/ScanModeTabs';
import type { ScanMode } from '@/components/ScanModeSelector';
import { cleanupProfileSummary, resolveCleanupProfile } from '@/lib/cleanup-profiles';
import { scanStrategySummary, resolveScanStrategy } from '@/lib/scan-strategy';
import { useI18n } from '@/i18n';
import type { Settings } from '@/types';

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
  const { t } = useI18n();
  const profileLabels: Record<string, string> = {
    safe: t('dashboard.scanTargets.profiles.safe'),
    balanced: t('dashboard.scanTargets.profiles.balanced'),
    aggressive: t('dashboard.scanTargets.profiles.aggressive'),
  };

  return (
    <Card className="border-border/40 bg-card/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('dashboard.scanTargets.title')}</CardTitle>
        <CardDescription>
          {ready ? t('dashboard.scanTargets.ready') : t('dashboard.scanTargets.notReady')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
            {t('dashboard.scanTargets.profile')}: {profileLabels[profile] ?? profile}
          </span>
          {settings ? (
            <>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {cleanupProfileSummary(resolveCleanupProfile(settings), settings)}
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                {t('dashboard.scanTargets.strategy')}:{' '}
                {scanStrategySummary(resolveScanStrategy(settings), settings)}
              </span>
            </>
          ) : null}
          {!ready ? (
            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-500">
              {t('dashboard.scanTargets.notReadyBadge')}
            </span>
          ) : null}
        </div>

        <Tabs value={mode} onValueChange={(v) => onModeChange(v as ScanMode)} className="w-full">
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