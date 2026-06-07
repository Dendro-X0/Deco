import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, HardDrive, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { formatBytes } from '@/lib/format';
import {
  isHandoffDismissed,
  type MigrationHandoffStatus,
  writeHandoffDismissSnapshot,
} from '@/lib/migration-handoff-types';
import { TOOL_MIGRATION_UI_PROFILES } from '@/lib/tool-migration-profiles';

type Props = {
  storageRefreshToken?: number;
  disabled?: boolean;
  onOpenMigration: (toolId?: string) => void;
};

function toolLabel(toolId: string): string {
  const profile = TOOL_MIGRATION_UI_PROFILES.find((p) => p.id === toolId);
  return profile?.label ?? toolId;
}

export function MigrationHandoffBanner({
  storageRefreshToken = 0,
  disabled,
  onOpenMigration,
}: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<MigrationHandoffStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = (await invoke('migration_handoff_status')) as MigrationHandoffStatus;
      setStatus(next);
      setDismissed(isHandoffDismissed(next.available_bytes));
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, storageRefreshToken]);

  if (loading || !status?.supported || !status.low_space || status.candidates.length === 0 || dismissed) {
    return null;
  }

  const mount = status.system_mount ?? 'C:\\';
  const freePct =
    status.free_pct != null ? `${Math.round(status.free_pct)}%` : '—';
  const freeBytes =
    status.available_bytes != null ? formatBytes(status.available_bytes) : '—';

  const names = status.candidates
    .slice(0, 3)
    .map((c) => toolLabel(c.tool))
    .join(', ');
  const extra = status.candidates.length > 3 ? ` +${status.candidates.length - 3}` : '';
  const totalCandidateBytes = status.candidates.reduce(
    (sum, c) => sum + (c.bytes ?? 0),
    0,
  );

  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 min-w-0">
          <HardDrive className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden />
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
              {t('dashboard.migrationHandoff.title', { mount, freePct, freeBytes })}
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {t('dashboard.migrationHandoff.description', {
                tools: `${names}${extra}`,
                size: totalCandidateBytes > 0 ? formatBytes(totalCandidateBytes) : t('common.unknown'),
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
            writeHandoffDismissSnapshot(status.available_bytes);
            setDismissed(true);
          }}
        >
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
      <Button
        type="button"
        size="sm"
        className="gap-1.5"
        disabled={disabled}
        onClick={() => onOpenMigration(status.suggested_tool)}
      >
        {t('dashboard.migrationHandoff.openSettings')}
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Button>
    </div>
  );
}
