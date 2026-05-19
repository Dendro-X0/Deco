import { FolderTree, HardDrive } from 'lucide-react';
import { useI18n } from '@/i18n';
import { cn } from '@/lib/utils';

export type ScanMode = 'partition' | 'custom';

type Props = {
  mode: ScanMode;
  onModeChange: (mode: ScanMode) => void;
  disabled?: boolean;
};

export function ScanModeSelector({ mode, onModeChange, disabled }: Props) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('dashboard.scanModeSelector.label')}
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange('partition')}
          className={cn(
            'rounded-xl border p-4 text-left transition-all',
            'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
            disabled && 'pointer-events-none opacity-60',
            mode === 'partition'
              ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/30'
              : 'border-border/50 bg-card/30 opacity-70',
          )}
        >
          <div className="flex items-start gap-3">
            <HardDrive
              size={20}
              className={cn('shrink-0 mt-0.5', mode === 'partition' ? 'text-primary' : 'text-muted-foreground')}
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold">{t('dashboard.scanModeSelector.partitionTitle')}</p>
              <p className="text-xs text-muted-foreground leading-snug">
                {t('dashboard.scanModeSelector.partitionDescription')}
              </p>
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => onModeChange('custom')}
          className={cn(
            'rounded-xl border p-4 text-left transition-all',
            'hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
            disabled && 'pointer-events-none opacity-60',
            mode === 'custom'
              ? 'border-primary/50 bg-primary/10 ring-1 ring-primary/30'
              : 'border-border/50 bg-card/30 opacity-70',
          )}
        >
          <div className="flex items-start gap-3">
            <FolderTree
              size={20}
              className={cn('shrink-0 mt-0.5', mode === 'custom' ? 'text-primary' : 'text-muted-foreground')}
            />
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-bold">{t('dashboard.scanModeSelector.customTitle')}</p>
              <p className="text-xs text-muted-foreground leading-snug">
                {t('dashboard.scanModeSelector.customDescription')}
              </p>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
