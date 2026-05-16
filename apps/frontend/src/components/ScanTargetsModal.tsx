import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PartitionPicker } from '@/components/PartitionPicker';

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  selectedVolumes: string[];
  includeProjectFolders: boolean;
  onSelectedVolumesChange: (mounts: string[]) => void;
  onIncludeProjectFoldersChange: (value: boolean) => void;
  title?: string;
};

export function ScanTargetsModal({
  open,
  onClose,
  onConfirm,
  selectedVolumes,
  includeProjectFolders,
  onSelectedVolumesChange,
  onIncludeProjectFoldersChange,
  title = 'Choose partitions to scan',
}: Props) {
  if (!open) return null;

  const canStart = selectedVolumes.length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        className="relative w-full max-w-2xl rounded-xl border bg-card shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
        role="dialog"
        aria-labelledby="scan-targets-title"
      >
        <div className="flex items-center justify-between border-b px-6 py-4 shrink-0">
          <div>
            <h3 id="scan-targets-title" className="text-lg font-bold">
              {title}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Select at least one drive. You can also include dev folders below.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-4 flex-1">
          <PartitionPicker
            showQuickAddSelect
            selectedVolumes={selectedVolumes}
            includeProjectFolders={includeProjectFolders}
            onSelectedVolumesChange={onSelectedVolumesChange}
            onIncludeProjectFoldersChange={onIncludeProjectFoldersChange}
          />
        </div>
        <div className="flex justify-end gap-2 border-t px-6 py-4 shrink-0">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canStart} className="font-semibold gap-2" onClick={onConfirm}>
            Start scan
          </Button>
        </div>
      </div>
    </div>
  );
}
