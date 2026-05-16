import { CustomScanRoots } from '@/components/CustomScanRoots';
import { PartitionPicker } from '@/components/PartitionPicker';
import { ScanModeSelector, type ScanMode } from '@/components/ScanModeSelector';
import { cn } from '@/lib/utils';

type Props = {
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  selectedVolumes: string[];
  includeProjectFolders: boolean;
  customScanRoots: string[];
  onSelectedVolumesChange: (mounts: string[]) => void;
  onIncludeProjectFoldersChange: (value: boolean) => void;
  onCustomScanRootsChange: (roots: string[]) => void;
  disabled?: boolean;
  showQuickAddSelect?: boolean;
  onError?: (message: string) => void;
  /** Settings: show only the active mode. Dashboard: gray out inactive mode. */
  layout?: 'overlay' | 'exclusive';
};

export function ScanTargetsPanel({
  mode,
  onModeChange,
  selectedVolumes,
  includeProjectFolders,
  customScanRoots,
  onSelectedVolumesChange,
  onIncludeProjectFoldersChange,
  onCustomScanRootsChange,
  disabled,
  showQuickAddSelect,
  onError,
  layout = 'overlay',
}: Props) {
  const partitionMode = mode === 'partition';
  const customMode = mode === 'custom';
  const exclusive = layout === 'exclusive';

  return (
    <div className="space-y-4">
      <ScanModeSelector mode={mode} onModeChange={onModeChange} disabled={disabled} />

      {(!exclusive || partitionMode) && (
        <div
          className={cn(
            !exclusive && 'transition-opacity duration-200',
            !exclusive &&
              !partitionMode &&
              'opacity-45 pointer-events-none select-none grayscale-[0.35]',
          )}
          aria-hidden={exclusive ? undefined : !partitionMode}
        >
          <PartitionPicker
            showQuickAddSelect={showQuickAddSelect}
            selectedVolumes={selectedVolumes}
            includeProjectFolders={includeProjectFolders}
            onSelectedVolumesChange={onSelectedVolumesChange}
            onIncludeProjectFoldersChange={onIncludeProjectFoldersChange}
            disabled={disabled || !partitionMode}
          />
        </div>
      )}

      {(!exclusive || customMode) && (
        <div
          className={cn(
            !exclusive && 'transition-opacity duration-200',
            !exclusive && !customMode && 'opacity-45 pointer-events-none select-none grayscale-[0.35]',
          )}
          aria-hidden={exclusive ? undefined : !customMode}
        >
          <CustomScanRoots
            roots={customScanRoots}
            onRootsChange={onCustomScanRootsChange}
            disabled={disabled || !customMode}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}
