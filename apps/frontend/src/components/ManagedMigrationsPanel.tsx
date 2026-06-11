import { useCallback, useEffect, useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, Copy, FolderOpen, X } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { migrationRollbackSteps } from '@/lib/migration-rollback-steps';
import { revealPathInExplorer } from '@/lib/policy-pack';
import { TOOL_MIGRATION_UI_PROFILES } from '@/lib/tool-migration-profiles';
import type { ManagedMigrationEntry } from '@/lib/tool-migration-types';

const ROLLBACK_GUIDE_URL =
  'https://github.com/Dendro-X0/Deco/blob/main/docs/desktop/ide-storage-off-os-drive.md#if-something-breaks';

function toolLabel(toolId: string): string {
  if (toolId === 'custom') return 'Custom';
  const profile = TOOL_MIGRATION_UI_PROFILES.find((p) => p.id === toolId);
  if (profile) return profile.label;
  return toolId;
}

function formatMigratedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString();
}

type Props = {
  disabled?: boolean;
  refreshKey?: number;
  onError?: (message: string) => void;
};

function RollbackStepsList({
  entry,
  disabled,
}: {
  entry: ManagedMigrationEntry;
  disabled?: boolean;
}) {
  const { t } = useI18n();
  const steps = migrationRollbackSteps(entry);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <ol className="list-decimal pl-4 space-y-1.5 text-[11px] leading-relaxed">
      {steps.map((step) => (
        <li key={step.id}>
          <span>{t(`settings.toolMigration.rollbackSteps.${step.id}`, { source: entry.source_path, dest: entry.dest_path })}</span>
          {step.command ? (
            <div className="mt-0.5 flex items-start gap-1">
              <code className="flex-1 font-mono break-all text-[10px] bg-muted/40 rounded px-1 py-0.5">
                {step.command}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 shrink-0"
                disabled={disabled}
                title={t('settings.toolMigration.configWizard.copy')}
                onClick={() => void copy(step.command!)}
              >
                <Copy className="h-3 w-3" aria-hidden />
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export function ManagedMigrationsPanel({ disabled, refreshKey = 0, onError }: Props) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<ManagedMigrationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRollbackId, setExpandedRollbackId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = (await invoke('migrate_tool_dir_list_managed', {
        syncDiscovered: true,
      })) as ManagedMigrationEntry[];
      setEntries(rows);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const openPath = async (path: string) => {
    try {
      await revealPathInExplorer(path);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    }
  };

  const removeEntry = async (id: string) => {
    try {
      await invoke('migrate_tool_dir_remove_managed', { id });
      setEntries((prev) => prev.filter((e) => e.id !== id));
      if (expandedRollbackId === id) setExpandedRollbackId(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      onError?.(msg);
    }
  };

  if (loading && entries.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground">{t('settings.toolMigration.managedLoading')}</p>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {t('settings.toolMigration.managedEmpty')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold">{t('settings.toolMigration.managedTitle')}</p>
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {t('settings.toolMigration.managedHint')}
      </p>
      <ul className="space-y-2 list-none pl-0">
        {entries.map((entry) => {
          const rollbackOpen = expandedRollbackId === entry.id;
          return (
            <li
              key={entry.id}
              className="rounded border border-border/40 bg-background/60 p-2 space-y-1.5 text-xs"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-semibold">
                    {toolLabel(entry.tool)}
                    {entry.leg ? (
                      <span className="text-muted-foreground font-normal capitalize"> · {entry.leg}</span>
                    ) : null}
                    {entry.discovered ? (
                      <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                        ({t('settings.toolMigration.managedDiscovered')})
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{formatMigratedAt(entry.migrated_at)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-7 w-7 p-0"
                  disabled={disabled}
                  title={t('settings.toolMigration.managedDismiss')}
                  onClick={() => void removeEntry(entry.id)}
                >
                  <X className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
              <p className="font-mono break-all text-[11px]">
                <span className="text-muted-foreground">{t('settings.toolMigration.source')}</span>{' '}
                {entry.source_path}
              </p>
              <p className="font-mono break-all text-[11px]">
                <span className="text-muted-foreground">{t('settings.toolMigration.dest')}</span>{' '}
                {entry.dest_path}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  disabled={disabled}
                  onClick={() => void openPath(entry.source_path)}
                >
                  <FolderOpen className="h-3 w-3" aria-hidden />
                  {t('settings.toolMigration.openSource')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  disabled={disabled}
                  onClick={() => void openPath(entry.dest_path)}
                >
                  <FolderOpen className="h-3 w-3" aria-hidden />
                  {t('settings.toolMigration.openDest')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  disabled={disabled}
                  onClick={() =>
                    setExpandedRollbackId(rollbackOpen ? null : entry.id)
                  }
                >
                  {rollbackOpen ? (
                    <ChevronUp className="h-3 w-3" aria-hidden />
                  ) : (
                    <ChevronDown className="h-3 w-3" aria-hidden />
                  )}
                  {t('settings.toolMigration.managedRollback')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-[11px]"
                  disabled={disabled}
                  onClick={() => void invoke('open_url', { url: ROLLBACK_GUIDE_URL })}
                >
                  <BookOpen className="h-3 w-3" aria-hidden />
                  {t('settings.toolMigration.rollbackGuide')}
                </Button>
              </div>
              {rollbackOpen ? (
                <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2 mt-1 space-y-1">
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                    {t('settings.toolMigration.rollbackSteps.title')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {t('settings.toolMigration.rollbackSteps.hint')}
                  </p>
                  <RollbackStepsList entry={entry} disabled={disabled} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
