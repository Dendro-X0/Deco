import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ShortcutRow = { keys: string; description: string };

const SHORTCUTS: ShortcutRow[] = [
  { keys: 'Ctrl+F', description: 'Focus candidate search' },
  { keys: 'Ctrl+Enter', description: 'Start scan (when targets are ready)' },
  { keys: 'Ctrl+Shift+L', description: 'Clear active filters' },
  { keys: '?  or  Ctrl+/', description: 'Show this shortcut list' },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export function KeyboardShortcutsDialog({ open, onClose }: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-dialog-title"
        className="relative z-10 w-full max-w-md rounded-xl border border-border/60 bg-card p-6 shadow-2xl"
      >
        <button
          type="button"
          className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:text-foreground"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <h2 id="shortcuts-dialog-title" className="pr-8 text-lg font-bold tracking-tight">
          Keyboard shortcuts
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Shortcuts are disabled while typing in a text field unless noted.
        </p>
        <ul className="mt-4 space-y-2">
          {SHORTCUTS.map((row) => (
            <li
              key={row.keys}
              className="flex items-center justify-between gap-4 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
            >
              <span className="text-sm text-muted-foreground">{row.description}</span>
              <kbd className="shrink-0 rounded border border-border/60 bg-background px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-foreground">
                {row.keys}
              </kbd>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end">
          <Button size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
