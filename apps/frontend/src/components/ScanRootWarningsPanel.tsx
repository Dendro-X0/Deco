import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import type { ScanRootWarning } from '@/lib/scan-root-warnings';

type Props = {
  warnings: ScanRootWarning[];
  onRemove: (path: string) => void;
  onAcknowledge?: () => void;
  showScanAnyway?: boolean;
  disabled?: boolean;
};

export function ScanRootWarningsPanel({
  warnings,
  onRemove,
  onAcknowledge,
  showScanAnyway,
  disabled,
}: Props) {
  const { t } = useI18n();
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden />
        <div className="space-y-2 min-w-0 flex-1">
          {warnings.map((w) => (
            <div key={`${w.id}:${w.path}`} className="space-y-1">
              <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                {t(`dashboard.scanRootWarnings.${w.id}`, { path: w.path })}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                disabled={disabled}
                onClick={() => onRemove(w.path)}
              >
                {t('dashboard.scanRootWarnings.removeFromScan')}
              </Button>
            </div>
          ))}
          {showScanAnyway && onAcknowledge ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-7 text-[11px]"
              disabled={disabled}
              onClick={onAcknowledge}
            >
              {t('dashboard.scanRootWarnings.scanAnyway')}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
