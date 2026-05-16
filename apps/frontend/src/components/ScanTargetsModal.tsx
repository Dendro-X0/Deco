import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScanTargetsPanel } from '@/components/ScanTargetsPanel';
import type { ScanMode } from '@/components/ScanModeSelector';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  selectedVolumes: string[];
  includeProjectFolders: boolean;
  customScanRoots: string[];
  onSelectedVolumesChange: (mounts: string[]) => void;
  onIncludeProjectFoldersChange: (value: boolean) => void;
  onCustomScanRootsChange: (roots: string[]) => void;
  onError?: (message: string) => void;
  title?: string;
};

export function ScanTargetsModal({
  open,
  onClose,
  onConfirm,
  mode,
  onModeChange,
  selectedVolumes,
  includeProjectFolders,
  customScanRoots,
  onSelectedVolumesChange,
  onIncludeProjectFoldersChange,
  onCustomScanRootsChange,
  onError,
  title = 'Choose scan targets',
}: Props) {
  if (!open) return null;

  const canStart =
    selectedVolumes.length > 0 && (mode === 'partition' || customScanRoots.length > 0);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center p-4">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative z-10 grid h-[min(85dvh,52rem)] w-full max-w-2xl max-h-[calc(100vh-2rem)] grid-rows-[auto_1fr_auto] overflow-hidden rounded-xl border bg-card shadow-2xl"
        role="dialog"
        aria-labelledby="scan-targets-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between border-b px-6 py-4">
          <div>
            <h3 id="scan-targets-title" className="text-lg font-bold">
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Pick a scanning mode, then configure partitions or custom folders.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </header>
        <div
          className="min-h-0 overflow-y-auto overflow-x-hidden deco-scrollbar px-6 py-4"
          role="region"
          aria-label="Scan target options"
        >
          <ScanTargetsPanel
            mode={mode}
            onModeChange={onModeChange}
            showQuickAddSelect
            selectedVolumes={selectedVolumes}
            includeProjectFolders={includeProjectFolders}
            customScanRoots={customScanRoots}
            onSelectedVolumesChange={onSelectedVolumesChange}
            onIncludeProjectFoldersChange={onIncludeProjectFoldersChange}
            onCustomScanRootsChange={onCustomScanRootsChange}
            onError={onError}
          />
        </div>
        <footer className="flex shrink-0 justify-end gap-2 border-t px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canStart} className="gap-2 font-semibold" onClick={onConfirm}>
            Start scan
          </Button>
        </footer>
      </div>
    </div>
  );
}
