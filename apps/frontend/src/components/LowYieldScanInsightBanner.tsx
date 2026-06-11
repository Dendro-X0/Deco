import { useMemo, useState } from 'react';
import { ArrowRight, Info, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { formatBytes } from '@/lib/format';
import {
  reclaimableBytesFromReport,
  shouldShowLowYieldScanInsight,
  type ScanInsightContext,
} from '@/lib/scan-insight';
import type { ScanReport } from '@/types';

function defaultSystemMount(): string {
  if (typeof navigator !== 'undefined' && /Win/i.test(navigator.userAgent)) {
    return 'C:\\';
  }
  return '/';
}

const CAPABILITIES_URL =
  'https://github.com/Dendro-X0/Deco/blob/main/docs/product/capabilities-and-limits.md';

const DISMISS_KEY = 'deco-low-yield-insight-scan-id';

type Props = {
  report: ScanReport | null | undefined;
  scanning: boolean;
  scanMode: 'partition' | 'custom';
  selectedVolumes: readonly string[];
  customScanRoots: readonly string[];
  disabled?: boolean;
  onOpenMigration: () => void;
};

export function LowYieldScanInsightBanner({
  report,
  scanning,
  scanMode,
  selectedVolumes,
  customScanRoots,
  disabled,
  onOpenMigration,
}: Props) {
  const { t } = useI18n();
  const systemMount = defaultSystemMount();
  const [dismissedScanId, setDismissedScanId] = useState<string | null>(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  const ctx: ScanInsightContext = useMemo(
    () => ({
      scanMode,
      selectedVolumes,
      customScanRoots,
      systemMount,
    }),
    [scanMode, selectedVolumes, customScanRoots, systemMount],
  );

  const visible =
    !scanning &&
    report?.scan_id &&
    dismissedScanId !== report.scan_id &&
    shouldShowLowYieldScanInsight(report, ctx);

  if (!visible) return null;

  const reclaimable = reclaimableBytesFromReport(report);
  const mount = systemMount;

  return (
    <div className="rounded-lg border border-sky-500/35 bg-sky-500/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <Info className="h-5 w-5 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" aria-hidden />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-semibold text-sky-950 dark:text-sky-100">
              {t('dashboard.lowYieldInsight.title', { mount })}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('dashboard.lowYieldInsight.description', {
                reclaimable: formatBytes(reclaimable),
              })}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="shrink-0 h-8 w-8 p-0"
          disabled={disabled}
          aria-label={t('common.dismiss')}
          onClick={() => {
            if (report?.scan_id) {
              try {
                sessionStorage.setItem(DISMISS_KEY, report.scan_id);
              } catch {
                // ignore
              }
              setDismissedScanId(report.scan_id);
            }
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
          disabled={disabled}
          onClick={() => void invoke('open_url', { url: CAPABILITIES_URL })}
        >
          {t('dashboard.lowYieldInsight.readLimits')}
        </Button>
        <Button
          type="button"
          size="sm"
          className="gap-1.5 text-xs"
          disabled={disabled}
          onClick={onOpenMigration}
        >
          {t('dashboard.lowYieldInsight.openMigration')}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
