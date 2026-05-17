import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={busy ? undefined : onCancel}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={onCancel}
          disabled={busy}
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <h2 id="confirm-dialog-title" className="text-lg font-bold tracking-tight pr-8">
          {title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            size="sm"
            onClick={onConfirm}
            disabled={busy || confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
