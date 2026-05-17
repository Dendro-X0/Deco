import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DisabledActionHint } from '@/components/DisabledActionHint';
import { cleanupActionLabels } from '@/lib/delete-mode';
import { formatBytes } from '@/lib/format';

type Props = {
  selectedCount: number;
  selectedBytes: number;
  deleteMode: string;
  cleanDisabledReason: string | null;
  busy?: boolean;
  onClean: () => void;
  onClearSelection: () => void;
  /** When default cleanup is quarantine, offer one-click permanent delete (with separate confirm). */
  onDeleteDirectly?: () => void;
};

export function SelectionActionBar({
  selectedCount,
  selectedBytes,
  deleteMode,
  cleanDisabledReason,
  busy,
  onClean,
  onClearSelection,
  onDeleteDirectly,
}: Props) {
  if (selectedCount === 0) return null;
  const labels = cleanupActionLabels(deleteMode);
  const showDirectDelete = deleteMode === 'quarantine' && onDeleteDirectly != null;

  return (
    <div className="fixed bottom-14 left-64 right-0 z-40 px-8 pointer-events-none">
      <div className="max-w-7xl mx-auto pointer-events-auto flex items-center justify-between gap-4 rounded-xl border border-primary/30 bg-card/95 backdrop-blur-md shadow-lg px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-primary">
            {selectedCount} selected
            <span className="text-muted-foreground font-medium"> · {formatBytes(selectedBytes)}</span>
          </p>
          <p className="text-[10px] text-muted-foreground">{labels.barHint}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="gap-1 h-8" disabled={busy} onClick={onClearSelection}>
            <X size={14} />
            Clear
          </Button>
          {showDirectDelete && (
            <DisabledActionHint reason={cleanDisabledReason}>
              <Button
                variant="outline"
                size="sm"
                className="gap-1 h-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={cleanDisabledReason !== null || busy}
                onClick={onDeleteDirectly}
              >
                <Trash2 size={14} />
                Delete permanently…
              </Button>
            </DisabledActionHint>
          )}
          <DisabledActionHint reason={cleanDisabledReason}>
            <Button
              size="sm"
              className="gap-1 h-8 font-semibold"
              disabled={cleanDisabledReason !== null || busy}
              onClick={onClean}
            >
              <Trash2 size={14} />
              {labels.button}
            </Button>
          </DisabledActionHint>
        </div>
      </div>
    </div>
  );
}
