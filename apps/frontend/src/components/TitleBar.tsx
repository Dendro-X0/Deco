import { useEffect, useState, type ReactNode } from 'react';
import { Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { DecoLogo } from '@/components/DecoLogo';
import { isTauriRuntime } from '@/lib/tauri';
import { cn } from '@/lib/utils';

function WindowControl({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 w-11 items-center justify-center text-muted-foreground transition-colors',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function TitleBar() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const win = getCurrentWindow();
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void win.isMaximized().then((v) => {
      if (!disposed) setMaximized(v);
    });

    void win.onResized(() => {
      void win.isMaximized().then((v) => {
        if (!disposed) setMaximized(v);
      });
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  if (!isTauriRuntime()) return null;

  const win = getCurrentWindow();

  return (
    <header className="flex h-9 shrink-0 items-stretch border-b border-border/80 bg-card/95 backdrop-blur-md select-none">
      <div className="flex flex-1 items-center gap-3 px-3 min-w-0" data-tauri-drag-region>
        <DecoLogo size="sm" />
        <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground/80 hidden sm:inline">
          Developer cleanup
        </span>
      </div>

      <div className="flex items-stretch" onDoubleClick={() => void win.toggleMaximize()}>
        <WindowControl
          label="Minimize"
          onClick={() => void win.minimize()}
          className="hover:bg-muted/60 hover:text-foreground"
        >
          <Minus size={14} strokeWidth={2.25} />
        </WindowControl>
        <WindowControl
          label={maximized ? 'Restore' : 'Maximize'}
          onClick={() => void win.toggleMaximize()}
          className="hover:bg-muted/60 hover:text-foreground"
        >
          <Square
            size={12}
            strokeWidth={2.25}
            className={cn(maximized && 'scale-90')}
            fill={maximized ? 'currentColor' : 'none'}
          />
        </WindowControl>
        <WindowControl
          label="Close"
          onClick={() => void win.close()}
          className="hover:bg-destructive hover:text-destructive-foreground"
        >
          <X size={14} strokeWidth={2.25} />
        </WindowControl>
      </div>
    </header>
  );
}
