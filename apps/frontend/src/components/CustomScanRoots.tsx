import { useState } from 'react';
import { FolderOpen, FolderTree, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { mergeScanRoots, pickScanFolders } from '@/lib/pick-folders';

type Props = {
  roots: string[];
  onRootsChange: (roots: string[]) => void;
  disabled?: boolean;
  onError?: (message: string) => void;
};

export function CustomScanRoots({ roots, onRootsChange, disabled, onError }: Props) {
  const { t } = useI18n();
  const [picking, setPicking] = useState(false);

  const addFromDialog = async () => {
    setPicking(true);
    try {
      const picked = await pickScanFolders();
      if (!picked?.length) return;
      onRootsChange(mergeScanRoots(roots, picked));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    } finally {
      setPicking(false);
    }
  };

  const removeAt = (index: number) => {
    onRootsChange(roots.filter((_, i) => i !== index));
  };

  const revealPath = async (path: string) => {
    try {
      await invoke('reveal_path_in_explorer', { path });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    }
  };

  return (
    <div className="rounded-lg border border-border/50 bg-background/30 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <FolderTree size={16} className="text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold">{t('dashboard.customRoots.title')}</p>
          <p className="text-xs text-muted-foreground leading-snug">
            {t('dashboard.customRoots.description')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold"
          disabled={disabled || picking}
          onClick={() => void addFromDialog()}
        >
          <FolderOpen size={14} />
          {picking ? t('common.opening') : t('dashboard.customRoots.browse')}
        </Button>
        {roots.length > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            disabled={disabled}
            onClick={() => onRootsChange([])}
          >
            {t('dashboard.customRoots.clearAll')}
          </Button>
        ) : null}
      </div>

      {roots.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2 text-center border border-dashed border-border/50 rounded-md">
          {t('dashboard.customRoots.empty')}
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1 deco-scrollbar">
          {roots.map((path, index) => (
            <li
              key={`${path}-${index}`}
              className="flex items-center gap-2 rounded-md border border-border/40 bg-background/40 px-2 py-1.5"
            >
              <button
                type="button"
                title={t('dashboard.customRoots.showInExplorer')}
                className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                disabled={disabled}
                onClick={() => void revealPath(path)}
              >
                <FolderOpen size={14} />
              </button>
              <span
                className="flex-1 min-w-0 font-mono text-[11px] leading-snug truncate"
                title={path}
              >
                {path}
              </span>
              <button
                type="button"
                title={t('common.remove')}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                disabled={disabled}
                onClick={() => removeAt(index)}
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {roots.length > 0 ? (
        <p className="text-[10px] text-primary/90 font-medium">
          {roots.length === 1
            ? t('dashboard.customRoots.foldersReady', { count: roots.length })
            : t('dashboard.customRoots.foldersReadyPlural', { count: roots.length })}
        </p>
      ) : null}
    </div>
  );
}
